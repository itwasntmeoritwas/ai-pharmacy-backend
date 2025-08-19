module.exports = async (req, res) => {
  // Do NOT print the key, just whether it exists and its length
  const val = process.env.OPENAI_API_KEY || "";
  res.setHeader("Content-Type", "application/json");
  res.status(200).end(JSON.stringify({
    hasKey: Boolean(val),
    length: val.length
  }));
};
