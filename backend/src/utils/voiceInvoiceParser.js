function normalizeText(value = "") {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleCase(value = "") {
  return value
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function findBestMatch(list, extractedName, getLabel) {
  if (!extractedName) {
    return null;
  }

  const normalizedTarget = normalizeText(extractedName);
  if (!normalizedTarget) {
    return null;
  }

  const exactMatch = list.find((item) => normalizeText(getLabel(item)) === normalizedTarget);
  if (exactMatch) {
    return exactMatch;
  }

  return (
    list.find((item) => normalizeText(getLabel(item)).includes(normalizedTarget)) ||
    list.find((item) => normalizedTarget.includes(normalizeText(getLabel(item)))) ||
    null
  );
}

export function parseVoiceInvoiceCommand(command, { customers = [], products = [] } = {}) {
  const rawCommand = String(command || "").trim();

  if (!rawCommand) {
    return {
      draft: null,
      warnings: ["Voice command is empty"],
      extracted: {},
    };
  }

  const normalized = normalizeText(rawCommand);
  const warnings = [];

  const quantityMatch = normalized.match(/\b(\d+(?:\.\d+)?)\b/);
  const quantity = quantityMatch ? Number(quantityMatch[1]) : 1;

  const gstMatch =
    normalized.match(/\bgst\s+(\d+(?:\.\d+)?)\b/) ||
    normalized.match(/\b(\d+(?:\.\d+)?)\s*%\s*gst\b/);
  const gstRate = gstMatch ? Number(gstMatch[1]) : 18;

  const amountCandidates = Array.from(
    normalized.matchAll(/\b(?:rs|rupees|inr)?\s*(\d+(?:\.\d+)?)\b/g),
    (match) => Number(match[1])
  );
  const totalAmount = amountCandidates.length > 0 ? amountCandidates[amountCandidates.length - 1] : null;

  let customerName = "";
  const customerMatch =
    normalized.match(/\bto\s+([a-z][a-z\s]{1,40}?)(?=\s+(?:for|at|with|gst)\b|$)/) ||
    normalized.match(/\bfor\s+([a-z][a-z\s]{1,40}?)(?=\s+(?:rs|rupees|inr|\d)|$)/);

  if (customerMatch) {
    customerName = titleCase(customerMatch[1].trim());
  }

  let itemName = "";
  const itemMatch = normalized.match(
    /\b(?:give|add|create|make|generate|bill|invoice)\s+(\d+(?:\.\d+)?)\s+(.+?)(?=\s+(?:to|for|at|with|gst)\b|$)/
  );

  if (itemMatch) {
    itemName = titleCase(itemMatch[2].trim());
  } else if (quantityMatch) {
    const afterQuantity = normalized.slice(quantityMatch.index + quantityMatch[0].length).trim();
    const fallbackItem = afterQuantity.match(/^(.+?)(?=\s+(?:to|for|at|with|gst)\b|$)/);
    if (fallbackItem) {
      itemName = titleCase(fallbackItem[1].trim());
    }
  }

  const matchedCustomer = findBestMatch(customers, customerName, (customer) => customer.name);
  const matchedProduct = findBestMatch(products, itemName, (product) => product.name);

  const effectiveQuantity = Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
  const effectiveTotal = Number.isFinite(totalAmount) ? totalAmount : null;
  const unitPrice =
    effectiveTotal !== null
      ? Number((effectiveTotal / effectiveQuantity).toFixed(2))
      : matchedProduct?.price
        ? matchedProduct.price
        : 0;

  if (!customerName) {
    warnings.push("Could not clearly detect the customer name");
  } else if (!matchedCustomer) {
    warnings.push(`No saved customer matched "${customerName}"`);
  }

  if (!itemName) {
    warnings.push("Could not clearly detect the product or item name");
  } else if (!matchedProduct) {
    warnings.push(`No saved product matched "${itemName}". Bills can only use products available in stock.`);
  } else if (Number(matchedProduct.stock || 0) < effectiveQuantity) {
    warnings.push(`Only ${matchedProduct.stock} ${matchedProduct.unit || "units"} available for ${matchedProduct.name}`);
  }

  if (effectiveTotal === null && !matchedProduct?.price) {
    warnings.push("No amount detected, so the line item price needs review");
  }

  const today = new Date().toISOString().slice(0, 10);
  const draft = {
    customerId: matchedCustomer?._id ? String(matchedCustomer._id) : "",
    customerName,
    issueDate: today,
    dueDate: today,
    notes: `Generated from voice command: ${rawCommand}`,
    items: [
      {
        productId: matchedProduct?._id ? String(matchedProduct._id) : "",
        name: matchedProduct?.name || itemName,
        quantity: effectiveQuantity,
        unitPrice,
        gstRate: matchedProduct?.gstRate ?? gstRate,
        discountRate: 0,
      },
    ],
  };

  return {
    draft,
    warnings,
    extracted: {
      customerName,
      itemName,
      quantity: effectiveQuantity,
      totalAmount: effectiveTotal,
      gstRate,
      matchedCustomer: matchedCustomer
        ? { id: String(matchedCustomer._id), name: matchedCustomer.name }
        : null,
      matchedProduct: matchedProduct
        ? { id: String(matchedProduct._id), name: matchedProduct.name }
        : null,
    },
  };
}
