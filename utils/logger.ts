// tests/utils/logger.ts

export const greenCheck = "✅";
export const redCross = "❌";
export const yellowWarn = "⚠️";
export const sectionLine = "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";

export const logSuccess = (message: string, data?: any) => {
  console.log(`${greenCheck} ${message}`);
  if (data) console.dir(data, { depth: null });
};

export const logError = (message: string, error: any) => {
  console.log(`${redCross} ${message}`);
  console.error("↳ Error:", error.toString());
};

export const logInfo = (message: string) => {
  console.log(`${yellowWarn} ${message}`);
};

export const logSection = (title: string) => {
  console.log(`${sectionLine}📌 ${title}${sectionLine}`);
};
