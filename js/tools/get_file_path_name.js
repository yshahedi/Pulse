function GetFilePathName(file) {
    const lastSlashIndex = file?.lastIndexOf("/");
    const path = file?.substring(0, lastSlashIndex);
    const filename = file?.substring(lastSlashIndex + 1);
    return { path, filename };
}