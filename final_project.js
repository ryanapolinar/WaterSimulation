var prog;
var prg_show;
var FBO, FBO1, FBO2;
var texture, texture1, texture2;
var c_w, c_h; //canvas width and height
var timer, delay = 0, frames = 0;
var time, animation, pix;
var n = 512, n1 = n-1;
var prMatrix, mvMat, mvMatLoc, rotMat, posLocation, sampLoc, samp1Loc;

function main() {
	initGL();
	transl = -1.5;
	c_w = 600; //window.innerWidth - 50
	c_h = 512; //window.innerHeight - 10
	canvas.width = c_w;  
	canvas.height = c_h
	
	var err = "Your browser does not support "
	var ext
	try { 
		ext = gl.getExtension("OES_texture_float")
	} 
	catch(e) {}
	
	if ( !ext ) {
		alert(err + "OES_texture_float extension"); 
		return;
	}
	
	if (gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS) == 0){
		alert(err + "Vertex texture"); 
		return;
	}
	var ext = gl.getExtension("OES_element_index_uint");
	
	if ( !ext ) {
		alert(err + "OES_element_index_uint extension"); 
		return;
	}

	prog  = gl.createProgram();
	gl.attachShader(prog, getShader( gl, "shader-vs" ));
	gl.attachShader(prog, getShader( gl, "shader-fs" ));
	gl.linkProgram(prog);

	gl.useProgram(prog);
	var aPosLoc = gl.getAttribLocation(prog, "aPos");
	gl.enableVertexAttribArray( aPosLoc );
	var data = new Float32Array([-1,-1,  1,-1,  -1,1,  1,1]);
	gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
	gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
	gl.vertexAttribPointer(aPosLoc, 2, gl.FLOAT, gl.FALSE, 0, 0);

	pix = new Float32Array(4*n*n)
	var p = 0;
	var h = 1/n1;
	for(var i = 0; i < n; i++ ) {
		for(var j = 0; j < n; j++ ){
			var x = h*(j-n/2);
			var y = h*(i-n/2);
			pix[p++] = .8*Math.exp(-2500*(x*x + y*y));
			pix[p++] = 0;
			pix[p++] = 0;
			pix[p++] = 0;
		}
	}
	
	texture1 = gl.createTexture();
	gl.activeTexture(gl.TEXTURE1);
	gl.bindTexture(gl.TEXTURE_2D, texture1);
	gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, n, n, 0, gl.RGBA, gl.FLOAT, pix);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

	texture2 = gl.createTexture();
	gl.activeTexture(gl.TEXTURE2);
	gl.bindTexture(gl.TEXTURE_2D, texture2);
	gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, n, n, 0, gl.RGBA, gl.FLOAT, pix);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

	texture = gl.createTexture();
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, n, n, 0, gl.RGBA, gl.FLOAT, pix);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

	FBO = gl.createFramebuffer();
	gl.bindFramebuffer(gl.FRAMEBUFFER, FBO);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0,
	   gl.TEXTURE_2D, texture, 0);
	FBO1 = gl.createFramebuffer();
	gl.bindFramebuffer(gl.FRAMEBUFFER, FBO1);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0,
	   gl.TEXTURE_2D, texture1, 0);
	FBO2 = gl.createFramebuffer();
	gl.bindFramebuffer(gl.FRAMEBUFFER, FBO2);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0,
	   gl.TEXTURE_2D, texture2, 0);
	
	if( gl.checkFramebufferStatus(gl.FRAMEBUFFER) != gl.FRAMEBUFFER_COMPLETE) {
		alert(err + "FLOAT as the color attachment to an FBO");
	}

	sampLoc  = gl.getUniformLocation(prog, "samp");
	samp1Loc = gl.getUniformLocation(prog, "samp1");

	prog_show  = gl.createProgram();
	gl.attachShader(prog_show, getShader( gl, "shader-vs-show" ));
	gl.attachShader(prog_show, getShader( gl, "shader-fs-show" ));
	var posLocation = 2;
	gl.bindAttribLocation(prog_show, posLocation, "aPos");
	gl.linkProgram(prog_show);

	gl.useProgram(prog_show);
	gl.uniform1f(gl.getUniformLocation(prog_show, "d"), 1/n);

	var pt = new Float32Array(2*n*n);
	p = 0
	for(var i = 0; i < n; i++) {
		for(var j = 0; j < n; j++) {
			pt[p++] = h*j;  
			pt[p++] = h*i;
		}
	}
	
	var ind = new Uint32Array(2*n1*(n+1));
	p = 0;
	var t = 0;
	for (var i = 0; i < n1; i++) {
		for (var j = 0; j < n; j++) {
			ind[p++] = t+j;
			ind[p++] = t+j+n;
		}
		t += n;
		ind[p++] = t+n-1;
		ind[p++] = t;
	}
	
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, ind, gl.STATIC_DRAW);

	gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
	gl.bufferData(gl.ARRAY_BUFFER, pt, gl.STATIC_DRAW);
	gl.vertexAttribPointer(posLocation, 2, gl.FLOAT, false, 0, 0);
	gl.enableVertexAttribArray( posLocation );

	prMatrix = new CanvasMatrix4();
	prMatrix.perspective(45, c_w/c_h, .1, 100);
	gl.uniformMatrix4fv(gl.getUniformLocation(prog_show,"prMatrix"), false, new Float32Array(prMatrix.getAsArray()));
	
	mvMatrix = new CanvasMatrix4();
	rotMat = new CanvasMatrix4();
	rotMat.makeIdentity();
	//rotMat.scale(0.8,0.8,1,0)
	rotMat.rotate(-30, 1,0,0);
	
	mvMatLoc = gl.getUniformLocation(prog_show,"mvMatrix");

	gl.enable(gl.DEPTH_TEST);
	gl.clearColor(0, 0, 0, 1);
	timer = setInterval(fr, 500);
	time = new Date().getTime();
	animation = "animate";
	anim();

	canvas.resize = function(){
		c_w = 600;//window.innerWidth - 50;
		c_h = 512;//window.innerHeight - 10
		canvas.width = c_w;
		canvas.height = c_h
		prMatrix.makeIdentity();
		prMatrix.perspective(45, c_w/c_h, .1, 100);
		gl.uniformMatrix4fv( gl.getUniformLocation(prog_show,"prMatrix"), false, new Float32Array(prMatrix.getAsArray()));
		drawScene();
	}
}


function draw() {
	gl.viewport(0, 0, n, n);

	gl.useProgram(prog);
	gl.uniform1i(sampLoc, 0);
	gl.uniform1i(samp1Loc, 1);
	gl.bindFramebuffer(gl.FRAMEBUFFER, FBO2);
	gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

	gl.uniform1i(sampLoc, 1);
	gl.uniform1i(samp1Loc, 2);
	gl.bindFramebuffer(gl.FRAMEBUFFER, FBO);
	gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

	gl.uniform1i(sampLoc, 2);
	gl.uniform1i(samp1Loc, 0);
	gl.bindFramebuffer(gl.FRAMEBUFFER, FBO1);
	gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

	drawScene();
	frames++;
}


function drawScene() {
	gl.viewport(0, 0, c_w, c_h);
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	gl.useProgram(prog_show);
	rotMat.rotate(xRot/3, 1,0,0);
	rotMat.rotate(yRot/3, 0,1,0)
	rotMat.rotate(zRot, 0,0,1);
	yRot = xRot = zRot = 0;
	mvMatrix.makeIdentity();
	mvMatrix.translate(-.5, -.5, 0);
	mvMatrix.multRight(rotMat);
	mvMatrix.translate(0, 0, transl);
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
	gl.uniformMatrix4fv( mvMatLoc, false, new Float32Array(mvMatrix.getAsArray()));
	gl.drawElements(gl.TRIANGLE_STRIP, 2*n1*(n+1) - 2, gl.UNSIGNED_INT, 0);
}


function anim() {
	draw();
	switch ( animation ) {
	case "reset":
		gl.bindTexture(gl.TEXTURE_2D, texture1);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, n, n, 0, gl.RGBA, gl.FLOAT, pix);
		animation = "animate";
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, n, n, 0, gl.RGBA, gl.FLOAT, pix);
	case "animate":
		if (delay == 0) {
			requestAnimationFrame(anim);
		}
		else {
			setTimeout("requestAnimationFrame(anim)", delay);
			break;
		}
	case "stop":
		break;
   }
}


function run(v) {
	if( animation == "animate") {
		animation = "stop";
		document.getElementById('runBtn').value = "Run ";
	}
	else {
		animation = "animate";
		document.getElementById('runBtn').value = "Stop";
		anim();
	}
}


function reset() {
	if( animation == "stop" ) {
		animation = "reset";
		document.getElementById('runBtn').value = "Stop";
		anim();
	}
	else {
		animation = "reset";
	}
}


function fr() {
	var ti = new Date().getTime();
	var fps = Math.round(1000*frames/(ti - time));
	document.getElementById("framerate").value = fps;
	frames = 0;
	time = ti;
}


function setDelay(val) {
	delay = parseInt(val);
}
