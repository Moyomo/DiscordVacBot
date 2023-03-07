/**
* Prints an info message with timestamp in the console.
*
* @param {string} infoText - The info to log.
*/
export function info(infoText) {
    if (!infoText) infoText = '~empty string~'
    console.log(`\x1b[32m[${dateFormat(new Date())}]\x1b[0m ${infoText}\x1b[0m`);
}

/**
* Prints an error message with timestamp in the console.
*
* @param {Object} errorObject - The error object.
*/
export function error(errorObject) {
    if (!errorObject.name) errorObject.name = 'unknown error'
    if (!errorObject.message) errorObject.message = 'no error message'
    // console.log(errorObject)
    console.error(`\x1b[31m[${dateFormat(new Date())}]\x1b[0m \x1b[41m${errorObject.name}\x1b[0m\x1b[31m: ${errorObject.message}\x1b[0m`);
    // console.error(errorObject);
}

/**
* Prints a debug message with timestamp in the console.
*
* @param {string|Object} debugContent - The debug message or object.
*/
export function debug(debugContent) {
    if (debugContent == null) debugContent = 'invalid debug message value'
    if (typeof debugContent == 'object') {
        console.log(`\x1b[35m[${dateFormat(new Date())}]\x1b[0m ${debugContent}:\x1b[0m`);
        console.log(debugContent);
    }
    else {
        console.log(`\x1b[35m[${dateFormat(new Date())}]\x1b[0m ${debugContent}\x1b[0m`);
    }
}

/**
* Prints a warning message with timestamp in the console.
*
* @param {string} warningText - The warning message.
*/
export function warning(warningText) {
    if (!warningText) warningText = 'invalid warning message value'
    console.log(`\x1b[33m[${dateFormat(new Date())}] WARNING! ${warningText}\x1b[0m`);
}

/**
* Prints a highlighted message with timestamp in the console.
*
* @param {string} highlightText - The highlighted message.
*/
export function highlight(highlightText) {
    if (!highlightText) highlightText = 'invalid highlighted message value'
    console.log(`\x1b[96m[${dateFormat(new Date())}] ${highlightText}\x1b[0m`);
}

function dateFormat(date) {
    return date.getUTCFullYear() + "-" +
        ("0" + (date.getUTCMonth() + 1)).slice(-2) + "-" +
        ("0" + date.getUTCDate()).slice(-2) + " " +
        ("0" + (date.getUTCHours() - date.getTimezoneOffset() / 60)).slice(-2) + ":" +
        ("0" + date.getUTCMinutes()).slice(-2) + ":" +
        ("0" + date.getUTCSeconds()).slice(-2);
}