export function notFound(req, res) {
  res.status(404).json({ message: "Route not found" });
}

export function errorHandler(error, req, res, next) {
  const status = error.status || 500;
  const message = error.message || "Something went wrong";

  if (process.env.NODE_ENV !== "test") {
    console.error(error);
  }

  res.status(status).json({ message });
}
