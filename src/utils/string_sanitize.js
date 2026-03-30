
function specialChars(string) {
    return string.replaceAll(/\n/g, "\\n")
                 .replaceAll("\\", "\\\\")
                 .replaceAll("'", "\\'")
                 .replaceAll('"', '\\"');
 }

module.exports = { specialChars }