var GL;
var grav = -9.8;
var drag = 0.02;
var visc = 0.001;
var sfr = 0.04;
var colorRed = 0.0;
var colorGre = 0.0;
var colorBlu = 0.5;
var norm = 1.0;
var CANVAS;
var vertex_number = 128;  // Number of vertices used
var SIMUSIZEPX = 256;     // GPGPU simulation texture size in pixel
var SIMUWIDTH = 2;        // Simulation size in meters
var GPGPU_NPASS = 3;      // Number of GPGPU pass per rendering

var SHP_VARS = {};
var shader3D;
var waterShader;
var locationOfRed;
var locationOfGre;
var locationOfBlu;
var locationOfNorm;

var main = function() {
    CANVAS = document.getElementById("canvas");
    CANVAS.height = Math.min(window.innerWidth, window.innerHeight);
    CANVAS.width= CANVAS.height;
    GL = CANVAS.getContext("webgl", {antialias: false, alpha: false});

    /* ----- MOUSE DETECTION ----- */
	var POINTER_X = 0.5;
	var POINTER_Y = 0.5;

    CANVAS.addEventListener("mousemove", function(event){
      // Keep track of where the mouse is
      POINTER_X = (event.clientX - CANVAS.offsetLeft) / CANVAS.width;
      POINTER_Y = 1 - event.clientY / CANVAS.height;
    }, false);

    SOURCEFLOW = 0;
    CANVAS.addEventListener("mousedown", function() {
      // Start when user clicks
      SOURCEFLOW = 4;
    }, false);
    CANVAS.addEventListener("mouseout", function() {
      // Stop when mouse goes outside of canvas
      SOURCEFLOW = 0;
    }, false);
    CANVAS.addEventListener("mouseup", function() {
      // Stop when user releases the click
      SOURCEFLOW = 0;
    } , false);


    // OES TEXTURE FLOAT extension enabled
    var EXT_FLOAT = GL.getExtension('OES_texture_float') ||
      GL.getExtension('MOZ_OES_texture_float') ||
        GL.getExtension('WEBKIT_OES_texture_float');

    /* ----- HELPER FUNCTIONS ----- */

    /* ----- 3D SHADER ----- */
    var vertexShader3D = loadShaderFromDOM("vert-shader-3D");
    var fragmentShader3D = loadShaderFromDOM("frag-shader-3D");

    shader3D = GL.createProgram();
    GL.attachShader(shader3D, vertexShader3D);
    GL.attachShader(shader3D, fragmentShader3D);
    GL.linkProgram(shader3D);

	locationOfRed = GL.getUniformLocation(shader3D, "red");
	locationOfGre = GL.getUniformLocation(shader3D, "gre");
	locationOfBlu = GL.getUniformLocation(shader3D, "blu");
	locationOfNorm = GL.getUniformLocation(shader3D, "norm");

    SHP_VARS.three = {
      mvMatrix: GL.getUniformLocation(shader3D, "mvMatrix"),
      prMatrix: GL.getUniformLocation(shader3D, "prMatrix"),
      sampler: GL.getUniformLocation(shader3D, "sampler"),
      sampler_normals: GL.getUniformLocation(shader3D, "sampler_normals"),
      aPos: GL.getAttribLocation(shader3D, "aPos"),
    }

    /* ----- WATER SHADER ----- */
    vertexShader = loadShaderFromDOM("vert-shader-render");
    var waterFragShader = loadShaderFromDOM("frag-shader-water");

    waterShader = GL.createProgram();
    GL.attachShader(waterShader, vertexShader);
    GL.attachShader(waterShader, waterFragShader);
    GL.linkProgram(waterShader);

    SHP_VARS.water={
      dt: GL.getUniformLocation(waterShader, "dt"),
      H: GL.getUniformLocation(waterShader, "H"),
      b: GL.getUniformLocation(waterShader, "b"),
      g: GL.getUniformLocation(waterShader, "g"),

      mouse: GL.getUniformLocation(waterShader, "mouse"),
      sourceFlow: GL.getUniformLocation(waterShader, "sourceFlow"),
      sourceRadius: GL.getUniformLocation(waterShader, "sourceRadius"),

      epsilon: GL.getUniformLocation(waterShader, "epsilon"),
      scale: GL.getUniformLocation(waterShader, "scale"),

      sampler_water: GL.getUniformLocation(waterShader, "sampler_water"),
      sampler_normals : GL.getUniformLocation(waterShader, "sampler_normals"),

      position: GL.getAttribLocation(waterShader, "position")
    };

    GL.useProgram(waterShader);

    /* ----- COPY SHADER ----- */
    var copyFragShader = loadShaderFromDOM("frag-shader-copy");

    var copyShader = GL.createProgram();
    GL.attachShader(copyShader, vertexShader);
    GL.attachShader(copyShader, copyFragShader);
    GL.linkProgram(copyShader);

    SHP_VARS.copy = {
      scale : GL.getUniformLocation(copyShader, "scale"),
      sampler: GL.getUniformLocation(copyShader, "sampler"),
      position: GL.getAttribLocation(copyShader, "position")
    };

    GL.useProgram(copyShader);

    /* ----- NORMAL SHADER ----- */
    var normalFragShader = loadShaderFromDOM("frag-shader-normals");

    var normalShader = GL.createProgram();
    GL.attachShader(normalShader, vertexShader);
    GL.attachShader(normalShader, normalFragShader);
    GL.linkProgram(normalShader);

    SHP_VARS.normals={
      sampler: GL.getUniformLocation(normalShader, "sampler"),
      scale: GL.getUniformLocation(normalShader, "scale"),
      epsilon: GL.getUniformLocation(normalShader, "epsilon"),
      position: GL.getAttribLocation(normalShader, "position")
    };

    GL.useProgram(normalShader);

    /* ----- THE QUAD ----- */

    // VERTICES
    var quad_vertex = generateVertices(vertex_number);

    var QUAD_VERTEX = GL.createBuffer ();
    GL.bindBuffer(GL.ARRAY_BUFFER, QUAD_VERTEX);
    GL.bufferData(GL.ARRAY_BUFFER, new Float32Array(quad_vertex), GL.STATIC_DRAW);

    // TRIANGLE FACES
    var quad_faces = generateFaces(vertex_number);

    var QUAD_FACES = GL.createBuffer();
    GL.bindBuffer(GL.ELEMENT_ARRAY_BUFFER, QUAD_FACES);
    GL.bufferData(GL.ELEMENT_ARRAY_BUFFER, new Uint16Array(quad_faces), GL.STATIC_DRAW);


    /* ----- THE TEXTURE ----- */
    var renderingTexture = GL.createTexture();
    GL.pixelStorei(GL.UNPACK_FLIP_Y_WEBGL, true);
    GL.bindTexture(GL.TEXTURE_2D, renderingTexture);

    /* ----- RENDER TO TEXTURE ----- */
    /*
    After doing water calculations, store the data into a texture.
    Red will store the height deviation (h)
    Green and blue stores the water speed (u, v) along x and y axis
    */

    // WATER RTT
    var frameBuffer_water = GL.createFramebuffer();
    GL.bindFramebuffer(GL.FRAMEBUFFER, frameBuffer_water);

    var texture_water=GL.createTexture();
    GL.bindTexture(GL.TEXTURE_2D, texture_water);
    GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MAG_FILTER, GL.NEAREST);
    GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MIN_FILTER, GL.NEAREST);
    GL.texParameteri( GL.TEXTURE_2D, GL.TEXTURE_WRAP_S, GL.CLAMP_TO_EDGE );
    GL.texParameteri( GL.TEXTURE_2D, GL.TEXTURE_WRAP_T, GL.CLAMP_TO_EDGE );
    GL.texImage2D(GL.TEXTURE_2D, 0, GL.RGBA, SIMUSIZEPX, SIMUSIZEPX, 0, GL.RGBA, GL.FLOAT, null);
    GL.framebufferTexture2D(GL.FRAMEBUFFER, GL.COLOR_ATTACHMENT0, GL.TEXTURE_2D, texture_water, 0);

    // COPY RTT
    var frameBuffer_copy = GL.createFramebuffer();
    GL.bindFramebuffer(GL.FRAMEBUFFER, frameBuffer_copy);

    var texture_water_copy = GL.createTexture();
    GL.bindTexture(GL.TEXTURE_2D, texture_water_copy);
    GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MAG_FILTER, GL.NEAREST);
    GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MIN_FILTER, GL.NEAREST);
    GL.texParameteri( GL.TEXTURE_2D, GL.TEXTURE_WRAP_S, GL.CLAMP_TO_EDGE );
    GL.texParameteri( GL.TEXTURE_2D, GL.TEXTURE_WRAP_T, GL.CLAMP_TO_EDGE );
    GL.texImage2D(GL.TEXTURE_2D, 0, GL.RGBA, SIMUSIZEPX, SIMUSIZEPX, 0, GL.RGBA, GL.FLOAT, null);
    GL.framebufferTexture2D(GL.FRAMEBUFFER, GL.COLOR_ATTACHMENT0, GL.TEXTURE_2D, texture_water_copy, 0);

    // NORMALS RTT
    var frameBuffer_normals = GL.createFramebuffer();
    GL.bindFramebuffer(GL.FRAMEBUFFER, frameBuffer_normals);

    var texture_normals = GL.createTexture();
    GL.bindTexture(GL.TEXTURE_2D, texture_normals);
    GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MAG_FILTER, GL.NEAREST);
    GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MIN_FILTER, GL.NEAREST);
    GL.texParameteri( GL.TEXTURE_2D, GL.TEXTURE_WRAP_S, GL.CLAMP_TO_EDGE );
    GL.texParameteri( GL.TEXTURE_2D, GL.TEXTURE_WRAP_T, GL.CLAMP_TO_EDGE );
    GL.texImage2D(GL.TEXTURE_2D, 0, GL.RGBA, SIMUSIZEPX, SIMUSIZEPX, 0, GL.RGBA, GL.FLOAT, null);
    GL.framebufferTexture2D(GL.FRAMEBUFFER, GL.COLOR_ATTACHMENT0, GL.TEXTURE_2D, texture_normals, 0);

    /* ----- INIT ----- */

    // WEBGL GENERAL INIT
    GL.clearColor(0.0, 0.0, 0.0, 0.0);

    GL.useProgram(shader3D);
    GL.uniform1i(SHP_VARS.three.sampler, 0);
    GL.uniform1i(SHP_VARS.three.sampler_normals, 1);
	GL.uniform1f(locationOfRed, colorRed);
	GL.uniform1f(locationOfGre, colorGre);
	GL.uniform1f(locationOfBlu, colorBlu);
	GL.uniform1f(locationOfNorm, norm);


    //SHADER PROGRAM GPGPU WATER INIT
    GL.useProgram(waterShader);
    GL.uniform1i(SHP_VARS.water.sampler_water, 0);
    GL.uniform1i(SHP_VARS.water.sampler_normals, 1);

    // SIMULATE A SQUARE WATER SURFACE SIDE MEASURING (SIMUWIDTH) METERS
    GL.uniform1f(SHP_VARS.water.g, grav);                       // gravity acceleration
    GL.uniform1f(SHP_VARS.water.H, drag);                       // mean height of water in meters
    GL.uniform1f(SHP_VARS.water.b, visc);                      // viscous drag coefficient
    GL.uniform1f(SHP_VARS.water.epsilon, 1 / SIMUSIZEPX);       // used to compute space derivatives
    GL.uniform1f(SHP_VARS.water.scale, SIMUWIDTH / SIMUSIZEPX);
    // Set the water source flow and radius
    GL.uniform1f(SHP_VARS.water.sourceFlow, 4);
    GL.uniform1f(SHP_VARS.water.sourceRadius, sfr);            // % of the surface flowed by the source
    // Send quad to vertex shader
    GL.enableVertexAttribArray(SHP_VARS.water.position);
    GL.bindBuffer(GL.ARRAY_BUFFER, QUAD_VERTEX);
    GL.vertexAttribPointer(SHP_VARS.water.position, 2, GL.FLOAT, false,8,0) ;
    GL.bindBuffer(GL.ELEMENT_ARRAY_BUFFER, QUAD_FACES);
    GL.disableVertexAttribArray(SHP_VARS.water.position);

    // SHADER PROGRAM TEXTURE COPY INIT
    GL.useProgram(copyShader);
    GL.uniform1f(SHP_VARS.copy.scale, SIMUSIZEPX);
    GL.uniform1i(SHP_VARS.copy.sampler, 0);
    GL.enableVertexAttribArray(SHP_VARS.copy.position);
    GL.bindBuffer(GL.ARRAY_BUFFER, QUAD_VERTEX);
    GL.vertexAttribPointer(SHP_VARS.copy.position, 2, GL.FLOAT, false,8,0) ;
    GL.bindBuffer(GL.ELEMENT_ARRAY_BUFFER, QUAD_FACES);
    GL.disableVertexAttribArray(SHP_VARS.copy.position);

    //SHADER PROGRAM NORMALS INIT
    GL.useProgram(normalShader);
    GL.uniform1i(SHP_VARS.normals.sampler, 0);
    GL.uniform1f(SHP_VARS.normals.epsilon, 1/SIMUSIZEPX); //used to compute space derivatives
    GL.uniform1f(SHP_VARS.normals.scale, SIMUWIDTH);

    GL.enableVertexAttribArray(SHP_VARS.normals.position);
    GL.bindBuffer(GL.ARRAY_BUFFER, QUAD_VERTEX);
    GL.vertexAttribPointer(SHP_VARS.normals.position, 2, GL.FLOAT, false,8,0) ;
    GL.bindBuffer(GL.ELEMENT_ARRAY_BUFFER, QUAD_FACES);
    GL.disableVertexAttribArray(SHP_VARS.normals.position);

    /* ----- RENDER LOOP ----- */
    var old_timestamp = 0;
    var animate = function(timestamp) {
      // Time step in seconds
      var dt = (timestamp - old_timestamp) / 1000;
      dt = Math.min(Math.abs(dt), 0.017);
      old_timestamp = timestamp;

      GL.clear(GL.COLOR_BUFFER_BIT);

      for (var i=0; i<GPGPU_NPASS; i++) {

        // COPY
        GL.bindFramebuffer(GL.FRAMEBUFFER, frameBuffer_copy);
        GL.useProgram(copyShader);
        GL.viewport(0.0, 0.0, SIMUSIZEPX, SIMUSIZEPX);
        GL.enableVertexAttribArray(SHP_VARS.copy.position);
        GL.bindTexture(GL.TEXTURE_2D, texture_water);
        GL.drawElements(GL.TRIANGLES, quad_faces.length, GL.UNSIGNED_SHORT, 0);
        GL.disableVertexAttribArray(SHP_VARS.copy.position);

        // GPGPU PHYSICAL SIMULATION:
        GL.bindFramebuffer(GL.FRAMEBUFFER, frameBuffer_water);
        GL.useProgram(waterShader);
        GL.enableVertexAttribArray(SHP_VARS.water.position);
        GL.activeTexture(GL.TEXTURE1);
        GL.bindTexture(GL.TEXTURE_2D, texture_normals);
        GL.activeTexture(GL.TEXTURE0);
        GL.bindTexture(GL.TEXTURE_2D, texture_water_copy);
        if (!i){
          // Optimize, only calculate when i = 0
          GL.uniform2f(SHP_VARS.water.mouse, POINTER_X, POINTER_Y);
          GL.uniform1f(SHP_VARS.water.sourceFlow, SOURCEFLOW);
          GL.uniform1f(SHP_VARS.water.dt, dt/GPGPU_NPASS);
        }
        GL.drawElements(GL.TRIANGLES, quad_faces.length, GL.UNSIGNED_SHORT, 0);
        GL.disableVertexAttribArray(SHP_VARS.water.position);

        //NORMALS : compute normals from the water map
        GL.bindFramebuffer(GL.FRAMEBUFFER, frameBuffer_normals);
        GL.useProgram(normalShader);
        GL.enableVertexAttribArray(SHP_VARS.normals.position);
        GL.bindTexture(GL.TEXTURE_2D, texture_water);
        GL.drawElements(GL.TRIANGLES, quad_faces.length, GL.UNSIGNED_SHORT, 0);
        GL.disableVertexAttribArray(SHP_VARS.normals.position);

      } // end of GPGPU_NPASS


      // RENDERING
      GL.bindFramebuffer(GL.FRAMEBUFFER, null);
      GL.useProgram(shader3D);

      // Set up the projection matrix (prMatrix)
      const fieldOfView = 45 * Math.PI / 180;   // in radians
      const aspect = GL.canvas.clientWidth / GL.canvas.clientHeight;
      const zNear = 0.1;
      const zFar = 100.0;
      const prMatrix = mat4.create();
      mat4.perspective(prMatrix,
                       fieldOfView,
                       aspect,
                       zNear,
                       zFar);

      // MODELVIEW MATRIX SETUP
      const mvMatrix = mat4.create();
      // Translate it to center it
      mat4.translate(mvMatrix, mvMatrix, [-0.485, -0.25, -1.5]);
      // Rotate so that faces the user
      mat4.rotate(mvMatrix, mvMatrix, -65 * Math.PI / 180, [1, 0, 0]);

      // Pass the projection and modelview matrices to the shaders
      GL.uniformMatrix4fv(SHP_VARS.three.prMatrix, false, prMatrix);
      GL.uniformMatrix4fv(SHP_VARS.three.mvMatrix, false, mvMatrix);

      // 3D SHADER PROGRAM RENDERING INIT
      GL.enableVertexAttribArray(SHP_VARS.three.aPos);
      GL.viewport(0.0, 0.0, CANVAS.width, CANVAS.height);
      GL.activeTexture(GL.TEXTURE1);
      GL.bindTexture(GL.TEXTURE_2D, texture_normals);
      GL.vertexAttribPointer(SHP_VARS.three.aPos, 2, GL.FLOAT, false,8,0) ;
      GL.drawElements(GL.TRIANGLES, quad_faces.length, GL.UNSIGNED_SHORT, 0);
      // Disable rendering attributes for next loop
      GL.disableVertexAttribArray(SHP_VARS.three.aPos);

      GL.flush();
      window.requestAnimationFrame(animate);
    };

    animate(new Date().getTime());
  };

function generateVertices(n){
  // Given n, generates n x n quad_vertices between [-1, 1]
  var quad = [];
  var step = 2 / (n - 1);
  for (var i = 0; i < n; i++){
    for (var j = 0; j < n; j++){
      // Push the x coordinate
      var x = (j * step) - 1.0;
      quad.push(x);
      // Push the y coordinate
      var y = (i * step) - 1.0;
      quad.push(y);
    }
  }

  return quad;
}

// Loads a shader program from an HTML element
function loadShaderFromDOM(id) {
  var shaderScript = document.getElementById(id);

  // If we don't find an element with the specified id
  // we do an early exit
  if (!shaderScript) {
	return null;
  }

  // Loop through the children for the found DOM element and
  // build up the shader source code as a string
  var shaderSource = "";
  var currentChild = shaderScript.firstChild;
  while (currentChild) {
	if (currentChild.nodeType == 3) { // 3 corresponds to TEXT_NODE
	  shaderSource += currentChild.textContent;
	}
	currentChild = currentChild.nextSibling;
  }

  var shader;
  if (shaderScript.type == "x-shader/x-fragment") {
	shader = GL.createShader(GL.FRAGMENT_SHADER);
  } else if (shaderScript.type == "x-shader/x-vertex") {
	shader = GL.createShader(GL.VERTEX_SHADER);
  } else {
	return null;
  }

  GL.shaderSource(shader, shaderSource);
  GL.compileShader(shader);

  if (!GL.getShaderParameter(shader, GL.COMPILE_STATUS)) {
	alert(GL.getShaderInfoLog(shader));
	return null;
  }
  return shader;
}

function generateFaces(n){
  // Given n, generates faces for an n x n quad
  var faces = [];

  // Create a lookup tool
  var vertices = [];
  for (var i = 0; i < n; i++){
    var row = [];
    for (var j = 0; j < n; j++){
      var vertex_num = (n*i) + j;
      row.push(vertex_num);
    }
    vertices.push(row);
  }

  // Create the faces
  for (var row = 0; row < (n-1); row++){
    for (var col = 0; col < (n-1); col++){
      // First triangle of the square
      faces.push(vertices[row][col]);
      faces.push(vertices[row][col + 1]);
      faces.push(vertices[row + 1][col + 1]);

      // Second triangle of the square
      faces.push(vertices[row][col]);
      faces.push(vertices[row + 1][col + 1]);
      faces.push(vertices[row + 1][col]);
    }
  }
  return faces;
}

function updateGravity(gravity) {
	var value = gravity*0.1;
	$("#sliderAmountGravity").html(value.toFixed(1));
	grav = -9.8 * value;
	GL.useProgram(waterShader);
	GL.uniform1f(SHP_VARS.water.g, grav);
}

function updateDrag(dragVal) {
	var value = dragVal;
	$("#sliderAmountDrag").html(value);
	drag = 0.02 / value;
	GL.useProgram(waterShader);
	GL.uniform1f(SHP_VARS.water.H, drag);
}

function updateVisc(viscVal) {
	var value = viscVal;
	$("#sliderAmountVisc").html(value);
	visc = 0.001 * value * value * value * value;
	GL.useProgram(waterShader);
	GL.uniform1f(SHP_VARS.water.b, visc);
}

function updateSFR(sfrVal) {
	var value = sfrVal;
	$("#sliderAmountSFR").html(value);
	sfr = 0.01 * value;
	GL.useProgram(waterShader);
	GL.uniform1f(SHP_VARS.water.sourceRadius, sfr);
}

function updateRed(redVal) {
	var value = redVal * 0.1;
	$("#sliderAmountRed").html(value.toFixed(1));
	colorRed = value;
	GL.useProgram(shader3D);
	GL.uniform1f(locationOfRed, colorRed);
}

function updateColor(colVal) {
	var id = parseInt(colVal, 10);
	switch (id) {
		case 1:
			colorRed = 0.0;
			colorGre = -0.13;
			colorBlu = -0.6;
			norm = 1.0;
			updateGravity(20);
			document.getElementById("grav").value = "20";
			updateDrag(1);
			document.getElementById("drag").value = "1";
			updateVisc(1);
			document.getElementById("visc").value = "1";
			updateRed(0);
			document.getElementById("tint").value = "0";
			updateSFR(4);
			document.getElementById("sfr").value = "4";
			break;
		case 2:
			colorRed = 0.0;
			colorGre = 0.0;
			colorBlu = 0.5;
			norm = 1.0;
			updateGravity(10);
			document.getElementById("grav").value = "10";
			updateDrag(1);
			document.getElementById("drag").value = "1";
			updateVisc(1);
			document.getElementById("visc").value = "1";
			updateRed(0);
			document.getElementById("tint").value = "0";
			updateSFR(4);
			document.getElementById("sfr").value = "4";
			break;
		case 3:
			colorRed = 0.55;
			colorGre = -0.13;
			colorBlu = -0.6;
			norm = 2.0;
			updateGravity(10);
			document.getElementById("grav").value = "30";
			updateDrag(2);
			document.getElementById("drag").value = "2";
			updateVisc(1);
			document.getElementById("visc").value = "10";
			updateRed(6);
			document.getElementById("tint").value = "6";
			updateSFR(4);
			document.getElementById("sfr").value = "4";
			break;
	}
	GL.useProgram(shader3D);
	GL.uniform1f(locationOfRed, colorRed);
	GL.uniform1f(locationOfGre, colorGre);
	GL.uniform1f(locationOfBlu, colorBlu);
	GL.uniform1f(locationOfNorm, norm);
}

function reset(){
  /*
	updateGravity(10);
	updateDrag(1.0);
	updateVisc(1.0);
	updateColor(2);
	updateSFR(4);
  */
  window.location.reload();
}
