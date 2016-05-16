Firefox-torrent
===============

A simple nodejs script that start a web server and display a magnet link content into the browser.
It uses torrent-stream so it can stream torrents.

It works like peerflix but with less functionnalities.

# Usage

``` node index.js ```

Then in the browser, just paste a magnet link after the url to display all the torrent's files eg :

``` localhost:3000/magnet:?xt=urn:btih:022692d131d3a44d770b38498022dffc9769104d&dn=Sintel.2010.Theora.Ogv-VODO```