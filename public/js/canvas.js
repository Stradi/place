var painter = document.querySelector("#painter");
var painterOperator = document.querySelector(".painter-operator");
painter.width = 2048;
painter.height = 2048;

var context = painter.getContext("2d");

var painterScale = 1;
var painterTransX = 0;
var painterTransY = 0;
var painterMouseDown = false;
var lastCursorClientX = null;
var lastCursorClientY = null;
var lastPixelX = null;
var lastPixelY = null;
var moved = false;
var initFingerDistance = null;
var localPainterScale = null;

var lastPixelData = null;
var gridPixelData = context.createImageData(2, 2);
var canvasData = context.getImageData(1, 1, 2048, 2048);
var canvasPixelArray = canvasData.data;

var lastInnerWidth = null;

var xAxis = document.querySelector("span.x-axis");
var yAxis = document.querySelector("span.y-axis");

var clickMask = document.querySelector("div.click-mask");
for (var i = 0; i != 4; ++i) {
  gridPixelData.data[4 * i] = 0;
  gridPixelData.data[4 * i + 1] = 0;
  gridPixelData.data[4 * i + 2] = 0;
  gridPixelData.data[4 * i + 3] = 255;
}

function setPainterTransform(scale) {
  painterOperator.style.transform = "translate(" + painterTransX + "px," + painterTransY + "px) " + "scale(" + (scale == undefined ? painterScale : scale) + ") ";
  painterOperator.style.webkitTransform = "translate(" + painterTransX + "px," + painterTransY + "px) " + "scale(" + (scale == undefined ? painterScale : scale) + ") ";
  painterOperator.style.mozTransform = "translate(" + painterTransX + "px," + painterTransY + "px) " + "scale(" + (scale == undefined ? painterScale : scale) + ") ";
}

var socket = io.connect('/',{transports: ['websocket']});

socket.emit('load image', {});

function initImageData(index, array){
  var mask = 1024 - 1;
  var row = Math.floor(index / 4 / 1024);
  var col = Math.floor(index / 4) & mask;
  var canvasRow = row * 2;
  var canvasCol = col * 2;
  for (var i = 0; i != 4; ++i) {
    var color = array[(row * 1024 + col) * 4 + i];
    canvasData.data[(canvasRow * 2048 + canvasCol) * 4 + i] = color;
    canvasData.data[(canvasRow * 2048 + canvasCol + 1) * 4 + i] = color;
    canvasData.data[((canvasRow + 1) * 2048 + canvasCol) * 4 + i] = color;
    canvasData.data[((canvasRow + 1) * 2048 + canvasCol + 1) * 4 + i] = color;
  }
}

function loadingMaskTransitionEnd(event){
  event.target.style.display = 'none';
}

socket.on('pixelData', function (data) {
  var imageData = new Uint8ClampedArray(data);
  if(typeof imageData.forEach == "function"){
    imageData.forEach(function(item, index, array){
      initImageData(index, array);
    })
  } else {
    for(var index = 0; index != imageData.length; ++ index){
      initImageData(index, imageData);
    }
  }
  context.putImageData(canvasData, 1, 1);
  var loadingMask = document.querySelector('div.loading-mask');
  loadingMask.style.opacity = 0;
  loadingMask.addEventListener("transitionend", loadingMaskTransitionEnd);
  loadingMask.addEventListener("webkitTransitionEnd", loadingMaskTransitionEnd);
  loadingMask = null;
})

socket.on('update', function(data){
  var dataView = new Uint8Array(data);
  var x = 0, y = 0;
  x |= dataView[0];
  x <<= 8;
  x |= dataView[1];
  y |= dataView[2];
  y <<= 8;
  y |= dataView[3];
  var realX = x * 2 + 1;
  var realY = y * 2 + 1;
  var colorBlock = context.createImageData(2, 2);
  if(typeof colorBlock.data.forEach == 'function') {
    colorBlock.data.forEach(function(item, index, array){
    array[index] = dataView[index % 4 + 4];
  })
  } else {
    for(var i = 0; i != colorBlock.data.length; ++ i){
      colorBlock.data[i] = dataView[i % 4 + 4];
    }
  }
  if(realX == lastPixelX && realY == lastPixelY){
    lastPixelData = colorBlock;
  }
  context.putImageData(colorBlock, realX, realY);
})

function clickMaskTransitionEnd(event){
  event.target.style.transition = "none";
  event.target.style.opacity = "";
  event.target.style.display = "none";
  event.target.style.transition = "";
}

painterOperator.addEventListener("click", function (event) {
  if(event.offsetX == 0 || event.offsetY == 0)
    return;
  var buffer = new ArrayBuffer(8);
  var arr = new Uint8Array(buffer);
  for(var i = 4; i != 8; ++ i){
    arr[i] = gridPixelData.data[i];
  }
  var x = Math.floor(event.offsetX - 1);
  var y = Math.floor(event.offsetY - 1);
  arr[0] = (x & ~(0xFF)) >> 8;
  arr[1] = x & 0xFF;
  arr[2] = (y & ~(0xFF)) >> 8;
  arr[3] = y & 0xFF;
  if (!moved) {
    clickMask.style.display = "flex";
    socket.emit('changePixel', buffer, function(confirmed){
      var realX = (event.offsetX - 1) * 2 + 1;
      var realY = (event.offsetY - 1) * 2 + 1;
      if(confirmed){
        var colorBlock = context.createImageData(2, 2);
        if(typeof colorBlock.data.forEach == "function"){
          colorBlock.data.forEach(function(item, index, array){
            array[index] = arr[index % 4 + 4];
          })
        } else {
          for(var i = 0; i != colorBlock.data.length; ++ i){
            colorBlock.data[i] = arr[i % 4 + 4];
          }
        }

        if(realX == lastPixelX && realY == lastPixelY){
          lastPixelData = colorBlock;
        }

        context.putImageData(colorBlock, realX, realY);
      }
      else{
        alert("server error");
      }
      clickMask.style.opacity = "0";
      clickMask.addEventListener("transitionend", clickMaskTransitionEnd);
      clickMask.addEventListener("webkitTransitionEnd", clickMaskTransitionEnd);
    })
  }
  moved = false;
});

(function () {

  painterOperator.addEventListener("wheel", function (event) {
    var cursorX = (event.offsetX - 512) * painterScale;
    var cursorY = (event.offsetY - 512) * painterScale;

    if (event.wheelDelta > 0) {
      painterScale *= 1.3;
      painterScale = Math.min(painterScale, 30)
    } else if (event.wheelDelta < 0) {
      painterScale /= 1.3;
      painterScale = Math.max(painterScale, 0.25)
    }
    else {
      return;
    }

    var newCursorX = (event.offsetX - 512) * painterScale;
    var newCursorY = (event.offsetY - 512) * painterScale;

    painterTransX += cursorX - newCursorX;
    painterTransY += cursorY - newCursorY;

    setPainterTransform()
    return;
  }, true)

  painterOperator.addEventListener("mousedown", function (event) {
    painterMouseDown = true;
  })

  painterOperator.addEventListener("mouseup", function (event) {
    painterMouseDown = false;
    lastCursorClientX = null;
    lastCursorClientY = null;
    painterOperator.style.cursor = "default";
  })

  function handleMove(event){
    painterOperator.style.cursor = "move";
    moved = true;
    var clientX, clientY;
    switch(event.type){
      case "mousemove":
        clientX = event.clientX;
        clientY = event.clientY;
      break;
      case "touchmove":
        clientX = event.touches[0].clientX;
        clientY = event.touches[0].clientY;
      break;
      default:
      break;
    }
    if (lastCursorClientX != null) {
        painterTransX += clientX - lastCursorClientX;
        painterTransY += clientY - lastCursorClientY;
        setPainterTransform();
    }
    lastCursorClientX = clientX;
    lastCursorClientY = clientY;
  }

  function resetClientCursor(){
    lastCursorClientX = null;
    lastCursorClientY = null;
    moved = false;
    painterOperator.style.cursor = "default";
  }

  function handleScale(event){
    if(localPainterScale == null){
      localPainterScale = painterScale;
    }

    var xDis = event.touches[0].clientX - event.touches[1].clientX;
    var yDis = event.touches[0].clientY - event.touches[1].clientY;
    var currentDistance = Math.sqrt(xDis * xDis + yDis * yDis);

    if(initFingerDistance == null) {
      initFingerDistance = currentDistance;
      return;
    }

    var offsetX = (event.touches[0].clientX + event.touches[1].clientX) / 2;
    var offsetY = (event.touches[0].clientY + event.touches[1].clientY) / 2;
    var offsetLeft = $(event.target).offset().left;
    var offsetTop = $(event.target).offset().top;
    offsetX = (offsetX - offsetLeft) / localPainterScale;
    offsetY = (offsetY - offsetTop) / localPainterScale;
    var cursorX = (offsetX - 512) * localPainterScale;
    var cursorY = (offsetY - 512) * localPainterScale;

    var ratio = currentDistance / initFingerDistance;

    localPainterScale = Math.min(painterScale * ratio, 30);
    localPainterScale = Math.max(painterScale * ratio, innerWidth / 2048);

    var newCursorX = (offsetX - 512) * localPainterScale;
    var newCursorY = (offsetY - 512) * localPainterScale;

    painterTransX += cursorX - newCursorX;
    painterTransY += cursorY - newCursorY;

    setPainterTransform(localPainterScale);
    return;
  }

  painterOperator.addEventListener("touchmove", function(event){
    event.preventDefault();
    event.stopPropagation();
    switch(event.touches.length){
      case 1:
        handleMove(event);
      break;
      case 2:
        handleScale(event);
      break;
    }
  })

  painterOperator.addEventListener("touchend", function(){
    if(localPainterScale != null){
      painterScale = localPainterScale;
    }
    localPainterScale = null;
    initFingerDistance = null;
    resetClientCursor();
  })

  painterOperator.addEventListener("mousemove", function(event) {
    if (event.offsetX == 0 || event.offsetY == 0 || (event.movementX == 0 && event.movementY == 0))
      return;
    var pixelX = (event.offsetX - 1) * 2 + 1;
    var pixelY = (event.offsetY - 1) * 2 + 1;

    var pixelData = context.getImageData(pixelX, pixelY, 2, 2);

    if (lastPixelData != null) {
      context.putImageData(lastPixelData, lastPixelX, lastPixelY);
    }

    if (pixelX != lastPixelX || pixelY != lastPixelY) {
      lastPixelData = pixelData;
      lastPixelX = pixelX;
      lastPixelY = pixelY;
    }

    context.putImageData(gridPixelData, pixelX, pixelY);

    if (painterMouseDown) {
      handleMove(event)
    }

    xAxis.textContent=event.offsetX - 1;
    yAxis.textContent=event.offsetY - 1;
  });

  painterOperator.addEventListener("mouseenter", function (event) {
  });

  painterOperator.addEventListener("mouseleave", function (event) {
    resetClientCursor();
    painterMouseDown = false;
  })
})();

trigger = document.querySelector(".trigger");
trigger.close = function(){
  trigger.parentElement.classList.remove('sk-open');
  trigger.parentElement.classList.add('sk-close');
  for(var i = 0; i != trigger.childElementCount; ++ i) {
    trigger.children[i].style.backgroundColor = "#B71C1C";
  }
}

trigger.open = function(){
  trigger.parentElement.classList.remove('sk-close');
  trigger.parentElement.classList.add('sk-open');
  for(var i = 0; i != trigger.childElementCount; ++ i) {
    trigger.children[i].style.backgroundColor = "#B71C1C";
  }
}
trigger.change = function(){
  if(trigger.parentElement.classList.contains("sk-close")){
    trigger.open();
  }
  else{
    trigger.close();
  }
}

trigger.addEventListener("mouseover", function(event){
  for(var i = 0; i != trigger.childElementCount; ++ i) {
    trigger.children[i].style.backgroundColor = "#D32F2F";
  }
})

trigger.addEventListener("mouseout", function(event){
  for(var i = 0; i != trigger.childElementCount; ++ i) {
    trigger.children[i].style.backgroundColor = "#B71C1C";
  }
})

trigger.addEventListener("click", function(event){
  trigger.change();
})

window.addEventListener("load", function(event){
  lastInnerWidth = innerWidth;
  if(lastInnerWidth < 640){
    trigger.close();
  }
})

window.addEventListener("resize", function(event){
  if(lastInnerWidth < 640 && innerWidth >= 640){
    trigger.open();
  }
  if(lastInnerWidth >= 640 && innerWidth < 640){
    trigger.close();
  }
  lastInnerWidth = innerWidth;
})

var colorForm = document.querySelector("form.color");
var yourColorBlock = document.querySelector(".your-color-block");

colorForm.addEventListener("input", function(event){
  var color = event.target.parentElement.id;
  var val = event.target.valueAsNumber;
  val < 0 ? val = 0 : val > 255 ? val = 255 : isNaN(val) ? val = 0 : 1;
  colorForm[color + "range"].valueAsNumber = val;
  colorForm[color + "text"].valueAsNumber = val;
  yourColorBlock.style.backgroundColor = "rgb(" + colorForm.rrange.value + "," + colorForm.grange.value + "," + colorForm.brange.value + ")";

  if(typeof gridPixelData.data.forEach == "function") {
    gridPixelData.data.forEach(function(item, index, array){
      switch(index % 4){
        case 0: array[index]=colorForm.rrange.value;break;
        case 1: array[index]=colorForm.grange.value;break;
        case 2: array[index]=colorForm.brange.value;break;
        case 3: break;
      }
    })
  } else {
    for(var i = 0; i != gridPixelData.data.length; ++ i){
      switch(i % 4){
        case 0: gridPixelData.data[i]=colorForm.rrange.value;break;
        case 1: gridPixelData.data[i]=colorForm.grange.value;break;
        case 2: gridPixelData.data[i]=colorForm.brange.value;break;
        case 3: break;
      }
    }
  }
});

var visitors = document.querySelector("span.visitors");
socket.on('updateVisitors', function(data){
  visitors.textContent = data;
})

var colorRegExp = /rgb\((.*?),(.*?),(.*?)\)/i;
document.querySelector("div.color-panel").addEventListener("click", function(event){
  if(!event.target.classList.contains("color-block")){
    return;
  }
  var colorBlock = event.target;
  var color = getComputedStyle(colorBlock).backgroundColor;
  yourColorBlock.style.backgroundColor = color;
  var matches = colorRegExp.exec(color);
  if(matches.length == 4){
    var r = Number.parseInt(matches[1]);
    var g = Number.parseInt(matches[2]);
    var b = Number.parseInt(matches[3]);
    colorForm.rtext.value = colorForm.rrange.value = r;
    colorForm.grange.value = colorForm.gtext.value = g;
    colorForm.brange.value = colorForm.btext.value = b;

    for(var i = 0; i != gridPixelData.data.length; ++ i){
      switch(i % 4){
        case 0: gridPixelData.data[i]=r;break;
        case 1: gridPixelData.data[i]=g;break;
        case 2: gridPixelData.data[i]=b;break;
        case 3: break;
      }
    }
  }
});
