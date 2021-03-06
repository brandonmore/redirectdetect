var fs = require('fs'), //require file system
    system = require('system'),
    server = require('webserver').create();

if (!Date.prototype.toISOString) {
    Date.prototype.toISOString = function () {
        function pad(n) { return n < 10 ? '0' + n : n; }
        function ms(n) { return n < 10 ? '00'+ n : n < 100 ? '0' + n : n }
        return this.getFullYear() + '-' +
            pad(this.getMonth() + 1) + '-' +
            pad(this.getDate()) + 'T' +
            pad(this.getHours()) + ':' +
            pad(this.getMinutes()) + ':' +
            pad(this.getSeconds()) + '.' +
            ms(this.getMilliseconds()) + 'Z';
    }
}

function createHAR(address, title, startTime, resources)
{
    var entries = [];

    resources.forEach(function (resource) {
        var request = resource.request,
            startReply = resource.startReply,
            endReply = resource.endReply;

        if (!request || !startReply || !endReply) {
            return;
        }

  //         // Exclude Data URI from HAR file because
  //         // they aren't included in specification
  //         if (request.url.match(/(^data:image\/.*)/i)) {
  //             return;
  // }

        entries.push({
            startedDateTime: request.time.toISOString(),
            time: endReply.time - request.time,
            request: {
                method: request.method,
                url: request.url,
                httpVersion: "HTTP/1.1",
                cookies: [],
                headers: request.headers,
                queryString: [],
                headersSize: -1,
                bodySize: -1
            },
            response: {
                status: endReply.status,
                statusText: endReply.statusText,
                httpVersion: "HTTP/1.1",
                cookies: [],
                headers: endReply.headers,
                redirectURL: "",
                headersSize: -1,
                bodySize: startReply.bodySize,
                content: {
                    size: startReply.bodySize,
                    mimeType: endReply.contentType
                }
            },
            cache: {},
            timings: {
                blocked: 0,
                dns: -1,
                connect: -1,
                send: 0,
                wait: startReply.time - request.time,
                receive: endReply.time - startReply.time,
                ssl: -1
            },
            pageref: address
        });
    });

    return {
        log: {
            version: '1.2',
            creator: {
                name: "PhantomJS",
                version: phantom.version.major + '.' + phantom.version.minor +
                    '.' + phantom.version.patch
            },
            pages: [{
                startedDateTime: startTime.toISOString(),
                id: address,
                title: title,
                pageTimings: {
                    onLoad: page.endTime - page.startTime
                }
            }],
            entries: entries
        }
    };
}

function netsniff(url,callback){
    page = require('webpage').create();
    page.address = url;
    page.resources = [];

    page.onLoadStarted = function () {
        page.startTime = new Date();
    };

    page.onResourceRequested = function (req) {
        page.resources[req.id] = {
            request: req,
            startReply: null,
            endReply: null
        };
    };

    page.onResourceReceived = function (res) {
        if (res.stage === 'start') {
            page.resources[res.id].startReply = res;
        }
        if (res.stage === 'end') {
            page.resources[res.id].endReply = res;
        }
    };

// ADDED TO IGNORE JS ERRORS IN HAR OUTPUT
    page.onError = function(msg, trace) {
        var msgStack = ['ERROR: ' + msg];
        if (trace && trace.length) {
            msgStack.push('TRACE:');
            trace.forEach(function(t) {
                msgStack.push(' -> ' + t.file + ': ' + t.line + (t.function ? ' (in function "' + t.function + '")' : ''));
            });
        }
        // uncomment to log into the console
        // console.error(msgStack.join('\n'));
    };
    page.open(page.address, function (status) {
        if (status !== 'success') {
            console.log('FAIL to load the address');
            //phantom.exit(1);
        } else {
            page.endTime = new Date();
            page.title = page.evaluate(function () {
                return document.title;
            });
            //TIMER ADDED
            setTimeout(function(){
            var har = createHAR(page.address, page.title, page.startTime, page.resources);
            callback(JSON.stringify(har, undefined, 4));
            //success(JSON.stringify(har, undefined, 4));
            //fs.write(encodeURIComponent(page.address)+'.har', JSON.stringify(har, undefined, 4), 'w');
            //console.log(JSON.stringify(har, undefined, 4));
                //phantom.exit();
            }, 15000);
        }
    });
}
// function success(har){
//     resp.write(har);
//     resp.close();
// }
//var resp = {};
var page;

//server init
var service = server.listen(8888, function(request, response) {
  response.headers = {'Access-Control-Allow-Origin':'*'};
  response.statusCode = 200;
  if(typeof request.url != 'undefined'){
    var url = request.url.replace(/^\/\?url\=/,'');
    var har = netsniff(url,function(har){
        response.write(har);
        response.close();
    });
  }

});
// if(system.args.length === 1){
//     console.log('Usage: har.js <some URL>');
//     phantom.exit(1);
// }
// netsniff(system.args[1]);
