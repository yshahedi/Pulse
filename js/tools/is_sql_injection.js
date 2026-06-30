function IsSqlInjection(str = "") {
  if (!str) return false;

  const suspiciousPatterns = [
    /(\bor\b|\band\b)\s+\d+=\d+/i,    // OR 1=1, AND 1=1
    /\bunion\b\s+\bselect\b/i,        // UNION SELECT
    /\bdrop\b\s+\btable\b/i,          // DROP TABLE
    /\binsert\b\s+\binto\b/i,         // INSERT INTO
    /\bupdate\b\s+\bset\b/i,          // UPDATE SET
    /\bdelete\b\s+\bfrom\b/i,         // DELETE FROM
    /--/,                              // inline comment
    /\/\*/i,                            // block comment start
    /\*\//i,                            // block comment end
    /'/,                                // single quote
    /"/                                 // double quote
  ];

  return suspiciousPatterns.some(p => p.test(str));
}