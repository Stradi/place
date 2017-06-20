var fs = require("fs");
var http = require("http");
var url = require("url");
var path = "./MySite"


/*var buffer = new Buffer(1024 * 1024 * 4);
buffer.forEach(function(item, index, array){
	if(index % 4 == 3){
		array[index] = 255;
	}
	else{
		array[index] = 255;
		//array[index] = Math.floor(Math.random() * 255);
	}
})
console.log(
	"Pixel Data Loaded"
);*/

var visitors = 0;

fs.readFile("./pic", function(err, data){
	if(err){
		var buffer = new Buffer(1024 * 1024 * 4);

		buffer.forEach(function(item, index, array){
				array[index] = 255;
		})
		console.log(
			"Empty Data Created"
		);
		fs.writeFile("./pic", buffer, function(err){
			if(err) console.log(err);
		});
		main(buffer);
	} else {
		console.log("Data Loaded")
		main(data);
	}
})

function main(buffer){
	var server = http.createServer(function (request, response) {
		var url_info = url.parse(request.url);
		var filename = path + url_info.pathname;
		if (url_info.path == "/"){
			if(request.headers.host == "pixelcanvas.cn"){
				filename += "/demos/canvas.html"
			}
			else{
				filename += "index.html";
			}
		}
		fs.readFile(filename, function (err, data) {
			if (err) {
				response.writeHead(404);
				response.end();
				console.log(err);
			}
			else {
				response.writeHead(200, {
					"Content-Length": data.length.toString(),
					"Connection": "keep-alive"
				});
				response.write(data);
				response.end();
			}
		})
	})

	var io = require('socket.io')(server, {"transports":['websocket']});

	io.on('connection', function(socket){

		io.clients(
			function(error, clients){
				if(clients != null)
					io.emit('updateVisitors', clients.length);
			}
		)

		socket.on('load image', function(data){
			console.log('sending pixel data');
			socket.emit('pixelData',buffer);
		});

		socket.on('changePixel', function(data, fn){
			var parsedData = parseData(data);
			if(!parsedData || typeof fn != 'function'){
				socket.disconnect();
				return;
			}
			for(i = 0; i != 4; ++ i){
				buffer[(parsedData[1] * 1024 + parsedData[0]) * 4 + i] = parsedData[2][i];
			}
			fs.writeFile("./pic", buffer, function(err){
				console.log("data saved", socket.handshake.address);
			});
			fn(true);
			socket.broadcast.emit('update', data);
		})
	});

	setInterval(function(){
		io.clients(
			function(error, clients){
				io.emit('updateVisitors', clients.length);
			})
		}, 10000);

	function parseData(data){
        if(typeof data != "object" || data.length != 8){
			return false;
		}
		var bufferView = new Uint8ClampedArray(data);
		var x = 0;
		var y = 0;
		x |= bufferView[0];
		x <<= 8;
		x |= bufferView[1];
		y |= bufferView[2];
		y <<= 8;
		y |= bufferView[3];
		if(x < 0 || x > 1023 || y < 0 || y > 1023)
			return false;
		var color = new Uint8ClampedArray(4);
		color.forEach(function(item, index, arr){
			arr[index] = bufferView[index + 4];
		});
		return [x,y,color];
	}
	server.listen(80);

}
