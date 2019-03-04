// exampleRequest
// {
//     "frameId": 0,
//     "method": "GET",
//     "parentFrameId": -1,
//     "requestId": "5209",
//     "tabId": 167,
//     "timeStamp": 1481925294894.168,
//     "type": "main_frame",
//     "url": "https://google.com"
// };

var NO_ACTION = {};

var lastInitSearchDate = null;
var searchJson = null;

function initSearch(searchJsonUrl) {
    if (lastInitSearchDate !== null && lastInitSearchDate - Date.now() >= -60000)
        return;

    lastInitSearchDate = Date.now();
    console.log("Trying to init search from url:", searchJsonUrl);

    // http://stackoverflow.com/questions/9421933/cross-origin-xmlhttprequest-in-chrome-extensions
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function () {
        if (xhr.readyState === XMLHttpRequest.DONE) {
            var data = xhr.responseText.match(/loadFromJson\(((.|\n)*)\)/);
            if (data) {
                searchJson = JSON.parse(data[1].replace(/\s\/\/.*/g, ''));
                console.log('SEARCH init SUCCESSFUL', searchJson);
            } else {
                console.log('SEARCH init FAILED', xhr.responseText);
            }
        }
    };
    xhr.open('GET', searchJsonUrl);
    xhr.send(null);
}

var search = function (details) {
    var url = details.url;
    if (!url.startsWith("https://coiiector.github.io/project/search.html"))
        return NO_ACTION;

    var hashIdx = url.indexOf('#');
    if (hashIdx === -1)
        return NO_ACTION;

    if (searchJson === null) {
        var queryIdx = url.indexOf('?');
        var query = queryIdx !== -1 && url.slice(queryIdx + 1, hashIdx);
        if (query) {
            initSearch(query);
        } else {
            console.log("Missing url in query.");
        }

        return NO_ACTION;
    }

    var hash = url.slice(hashIdx + 1);
    if (hash.indexOf(' ') === -1)
        hash = hash.replace(/\+/g, ' ');

    hash = decodeURIComponent(hash);
    var hashParamEndIdx = hash.indexOf(" ");
    var engineName = hash.slice(0, hashParamEndIdx);
    var value, engine;

    if (engineName in searchJson) {
        engine = searchJson[engineName];
        value = hash.slice(hashParamEndIdx + 1);
    } else if ('DEFAULT' in searchJson) {
        engine = searchJson.DEFAULT;
        value = hash;
    } else {
        return NO_ACTION;
    }

    console.log("Search :::", engineName, '::', value, ':::', engine);
    var newUrl = engine.replace(/\{ARG}/g, encodeURIComponent(value));
    return doRedirect(newUrl, details);
};

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

    return doRedirect(newUrl, details);
};

var reddit = function (details) {
    var url = details.url;
    if (url.indexOf('://out.reddit.com/') === -1)
        return NO_ACTION;

    var match = url.match(/\?url=([^&]+)/);
    if (!match)
        return NO_ACTION;

    return doRedirect(decodeURIComponent(match[1]), details);
};

var twitter = function (details) {
    var type = details.type;
    if (type !== "main_frame")
        return NO_ACTION;

    var url = details.url;
    var match = url.match(/^(https?:\/\/pbs\.twimg\.com\/media\/.*\.jpg)(?!:orig)/);
    if (!match)
        return NO_ACTION;

    return doRedirect(match[1] + ':orig', details);
};

var google = function (details) {
    var url = details.url;
    var match = url.match(/:\/\/www\.google\.\w+\/.*[?&]url=([^&#]+)/);
    if (!match)
        return NO_ACTION;

    return doRedirect(decodeURIComponent(match[1]), details);
};

var youtube = function (details) {
    var url = details.url;
    var match = url.match(/:\/\/www\.youtube\.com\/redirect.*[?&]q=([^&]*)/);
    if (!match)
        return NO_ACTION;

    var redirectUrl = decodeURIComponent(match[1]);
    if (!redirectUrl.startsWith('http'))
        return NO_ACTION;

    return doRedirect(redirectUrl, details);
};

function doRedirect(url, details) {
    console.log('redirecting', details.url, url);
    return {redirectUrl: url};
}

chrome.webRequest.onBeforeRequest.addListener(google, {urls: ["<all_urls>"]}, ["blocking"]);
chrome.webRequest.onBeforeRequest.addListener(youtube, {urls: ["<all_urls>"]}, ["blocking"]);
chrome.webRequest.onBeforeRequest.addListener(reddit, {urls: ["<all_urls>"]}, ["blocking"]);
chrome.webRequest.onBeforeRequest.addListener(handler, {urls: ["<all_urls>"]}, ["blocking"]);
chrome.webRequest.onBeforeRequest.addListener(twitter, {urls: ["<all_urls>"]}, ["blocking"]);
chrome.webRequest.onBeforeRequest.addListener(search, {urls: ["<all_urls>"]}, ["blocking"]);

function removeHeader(requestHeaders, headerName) {
    for (var i = 0; i < requestHeaders.length; ++i)
        if (requestHeaders[i].name === headerName)
            return requestHeaders.splice(i, 1);
}

function getHeaderObject(requestHeaders, headerName) {
    for (var i = 0; i < requestHeaders.length; ++i)
        if (requestHeaders[i].name === headerName)
            return requestHeaders[i];
}

var REFERER_HEADER_NAME = "Referer";
var OVERRIDE_REFERER = false;
if (OVERRIDE_REFERER) {
    chrome.webRequest.onBeforeSendHeaders.addListener(function (details) {
        var headers = details.requestHeaders;
        removeHeader(headers, REFERER_HEADER_NAME);
        headers.push({name: REFERER_HEADER_NAME, value: "https://www.google.com/"});
        console.log(headers);

        return {requestHeaders: headers};
    }, {urls: ["<all_urls>"]}, ['blocking', 'requestHeaders']);
}