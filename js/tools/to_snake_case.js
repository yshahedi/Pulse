function ToSnakeCase(str) {
    return str
        // Insert an underscore before any capital letter
        .replace(/([A-Z])/g, "_$1")
        // Convert to lowercase
        .toLowerCase()
        // Remove potential leading underscore
        .replace(/^_/, "");
}