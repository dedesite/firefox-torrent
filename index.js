'use strict';

/**
 * Module dependencies.
 * @private
 */
var torrentStream = require('torrent-stream');
var express = require('express');
var mime = require('mime');
var filesize = require('file-size');
var rangeParser = require('range-parser');
var path = require('path')
  , join = path.join;
var fs = require('fs');
var url = require('url');
var app = express();

//Usefull if we are fetching a specific file in a already open torrent
var currentLink = null;
var currentEngine = null;

//Works like serveIndex but do not search in a path but in a torrent
function serveTorrentIndex() {
  return function (req, res) {
    console.log('request recieved', req.path, req.url);
    var parsedUrl = url.parse(req.url, true);
    var forceDownload = false;
    //Recreate magnet link
    var link = parsedUrl.pathname + '?xt=' + parsedUrl.query['xt'];
    if(parsedUrl.pathname !== '/magnet:' || !parsedUrl.query['xt']){
      res.statusCode = 404;
      res.end('Not a magnet link : ' + parsedUrl.href);
      return;
    }

    if(parsedUrl.query['force']) {
      forceDownload = true;
      console.log('download is forced');
    }

    var index = null;
    if(parsedUrl.query['ind']) {
      index = parsedUrl.query['ind'];
      console.log('searching for file index', index);
    }

    var engine = null;
    if(link === currentLink && currentEngine != null) {
      console.log('current torrent finded', currentLink);
      engine = currentEngine;
      //Avoid to create the torrentStream again
      serveFiles(req, res, engine.files, index, currentLink, forceDownload);
    }
    else {
      console.log('new torrent at link', link);
      try {
        engine = torrentStream(link);
      } catch (err) {
        res.statusCode = 404;
        res.end('Invalid torrent identifier : ' + link);
        console.error(err);
        console.error(req.url);
        return;
      }
      currentLink = link;
      currentEngine = engine;
    }

    engine.on('ready', function(){
      serveFiles(req, res, engine.files, index, currentLink, forceDownload);
    });
  }
}

function serveFiles(req, res, files, index, link, forceDownload) {
  if(files.length > 1 && index === null) {
    serveHtmlFileList(req, res, files, link);
  }
  else if(files.length === 1 || index !== null) {
    var ind = files.length === 1 ? 0 : index;
    console.log(files);
    serveTorrentFile(req, res, files[ind], forceDownload);
  }
  else {
    res.statusCode = 404;
    res.end('No files in this torrent'); 
  }
}

function serveHtmlFileList(req, res, files, link){
  var torrentName = files[0].path.split('/')[0];
  console.log('Serving html file list for torrent', torrentName);

  var html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + torrentName + '"</title></head><body>';
  html += '<h1>' + torrentName + '</h1>';
  html += '<ul>';

  files.forEach(function(file, index){
    html += '<li>';
      html += '<a href=".' + link + '&ind=' + index + '">' + file.name + ' - ' + filesize(file.length).human() + '</a>';
      html += ' (<a href=".' + link + '&ind=' + index + '&force=1">download</a>)';
    html += '</li>';
  });

  html += '</ul></body></html>';

  var buf = new Buffer(html, 'utf8');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Length', buf.length);
  res.end(buf);
}

function serveTorrentFile(req, res, file, forceDownload){
  var contentType = mime.lookup(file.name);

  console.log('serving ', file.name, 'with mime type', contentType);

  res.setHeader('Content-Type', contentType + '; charset=utf-8');
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Content-Transfer-Encoding', 'binary');
  res.setHeader('transferMode.dlna.org', 'Streaming');
  res.setHeader('contentFeatures.dlna.org', 'DLNA.ORG_OP=01;DLNA.ORG_CI=0;DLNA.ORG_FLAGS=017000 00000000000000000000000000');
  if(forceDownload)
    res.setHeader('Content-Disposition', 'attachment; filename="' + file.name + '"');
  else
    res.setHeader('Content-Disposition', 'inline; filename="' + file.name + '"');

  //handle file seeking
  var range = req.headers.range;
  var stream = null;
  range = range && rangeParser(file.length, range)[0];
  if(range) {
    res.setHeader('Content-Range', 'bytes ' + range.start + '-' + range.end + '/' + file.length);
    res.statusCode = 206;
    res.setHeader('Content-Length', range.end - range.start + 1);
    stream = file.createReadStream({start: range.start, end: range.end});
  }
  else {
    res.setHeader('Content-Length', file.length);
    stream = file.createReadStream();
  }
  stream.pipe(res);
}

app.listen(3000, function () {
  console.log('Example app listening on port 3000!');
  //app.use(express.static('.'));
  //app.use('/', serveIndex('.', {'icons': true}))
  //app.use('/*', serveTorrentIndex({'icons': true}));
  app.get('/*', serveTorrentIndex());
});

//Sintel magnet link
//magnet:?xt=urn:btih:022692d131d3a44d770b38498022dffc9769104d&dn=Sintel.2010.Theora.Ogv-VODO