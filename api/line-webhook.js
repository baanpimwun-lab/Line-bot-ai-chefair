function parseCSV(text) {
  const lines = text.trim().split("\n");

  return lines.slice(1).map((line) => {
    const cols = line.split(",");

    return {
      question: cols[1]?.trim() || "",
      answer: cols[2]?.trim() || ""
    };
  });
}
