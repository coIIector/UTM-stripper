var NO_ACTION = {};

var handler = function (details) {
    var url = details.url;

    var queryIdx = url.indexOf('?');
    if (queryIdx === -1) {
        return NO_ACTION;
    }

    var query;
    var hashIdx = url.indexOf('#');
    if (hashIdx === -1) {
        query = url.slice(queryIdx + 1);
    } else {
        query = url.slice(queryIdx + 1, hashIdx);
    }

    var tracking = false;
    var split = query.split('&');
    var i = split.length;
    while (i--) {
        if (split[i].startsWith('utm_')) {
            split.splice(i, 1);
            tracking = true;
        }
    }

    if (!tracking) {
        return NO_ACTION;
    }

    var newUrl = url.slice(0, queryIdx + 1) + split.join('&');
    if (hashIdx !== -1) {
        newUrl += url.slice(hashIdx);
    }

    return {redirectUrl: newUrl};
};

chrome.webRequest.onBeforeRequest.addListener(handler, {urls: ["<all_urls>"]}, ["blocking"]);