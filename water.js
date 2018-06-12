var main = function() {

    var CANVAS = document.getElementById("canvas");
    CANVAS.height = Math.min(window.innerWidth, window.innerHeight);
    CANVAS.width= CANVAS.height;
    var GL = CANVAS.getContext("webgl", {antialias: false, alpha: false});

    // Detect mouse movements
    var POINTER_X=0.5, POINTER_Y=0.5;

    var mouseMove=function(event) {
      POINTER_X=(event.clientX-CANVAS.offsetLeft)/CANVAS.width;
      POINTER_Y=1-event.clientY/CANVAS.height;
    };
    CANVAS.addEventListener("mousemove", mouseMove, false);
    // Detect if the mouse is in the canvas or not
    SOURCEFLOW=0;
    CANVAS.addEventListener("mouseout", function() { SOURCEFLOW = 0; } , false);
    CANVAS.addEventListener("mouseenter", function() { SOURCEFLOW = 4; } , false);


    // OES TEXTURE FLOAT extension enabled
    var EXT_FLOAT = GL.getExtension('OES_texture_float') ||
      GL.getExtension('MOZ_OES_texture_float') ||
        GL.getExtension('WEBKIT_OES_texture_float');

    /* ----- PARAMETERS ----- */

    var SIMUSIZEPX = 512; //GPGPU simulation texture size in pixel
    var SIMUWIDTH = 2;    //Simulation size in meters
    var GPGPU_NPASS=3; //number of GPGPU pass per rendering

    var SHP_VARS = {};

    // Projection matrix
    var projection = mat4.create();
    // Model-View matrix
    var modelview = mat4.create();

    /* ----- HELPER FUNCTIONS ----- */

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

    /* ----- RENDERING SHADER ----- */
    vertexShader = loadShaderFromDOM("vert-shader-render");
    fragmentShader = loadShaderFromDOM("frag-shader-render");

    var renderShader = GL.createProgram();
    GL.attachShader(renderShader, vertexShader);
    GL.attachShader(renderShader, fragmentShader);
    GL.linkProgram(renderShader);


    SHP_VARS.rendering = {
      sampler: GL.getUniformLocation(renderShader, "sampler"),
      sampler_normals: GL.getUniformLocation(renderShader, "sampler_normals"),
      position: GL.getAttribLocation(renderShader, "position")
    }

    if (!GL.getProgramParameter(renderShader, GL.LINK_STATUS)) {
      alert("Failed to setup shaders");
    }

    GL.useProgram(renderShader);

    /* ----- WATER SHADER ----- */
    var waterFragShader = loadShaderFromDOM("frag-shader-water");

    var waterShader = GL.createProgram();
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
    // POINTS :
    var quad_vertex = [
      -1,-1, // bottom left
      1,-1,  // bottom right
      1,1,   // top right
      -1,1   // top left
    ];

    var QUAD_VERTEX= GL.createBuffer ();
    GL.bindBuffer(GL.ARRAY_BUFFER, QUAD_VERTEX);
    GL.bufferData(GL.ARRAY_BUFFER,new Float32Array(quad_vertex),GL.STATIC_DRAW);

    //FACES:
    var quad_faces = [
      0,1,2,
      0,2,3
    ];
    var QUAD_FACES= GL.createBuffer ();
    GL.bindBuffer(GL.ELEMENT_ARRAY_BUFFER, QUAD_FACES);
    GL.bufferData(GL.ELEMENT_ARRAY_BUFFER, new Uint16Array([0,1,2, 0,2,3]),GL.STATIC_DRAW);


    /* ----- THE TEXTURE ----- */

    var renderingImage = new Image();
    var imageURL = 'placeholder.jpg';
    renderingImage.src = imageURL;

    var renderingTexture = GL.createTexture();
    GL.pixelStorei(GL.UNPACK_FLIP_Y_WEBGL, true);
    GL.bindTexture(GL.TEXTURE_2D, renderingTexture);

    renderingImage.onload = function() {
      GL.bindTexture(GL.TEXTURE_2D, renderingTexture);
      GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MAG_FILTER, GL.LINEAR);
      GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MIN_FILTER, GL.LINEAR);
      GL.texImage2D(GL.TEXTURE_2D, 0, GL.RGBA, GL.RGBA, GL.UNSIGNED_BYTE, renderingImage);
    };

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
    GL.disable(GL.DEPTH_TEST);
    GL.disable(GL.SCISSOR_TEST);
    GL.clearColor(0.0, 0.0, 0.0, 0.0);


    // SHADER PROGRAM RENDERING INIT
    GL.useProgram(renderShader);
    GL.enableVertexAttribArray(SHP_VARS.rendering.position);
    GL.uniform1i(SHP_VARS.rendering.sampler, 0);
    GL.uniform1i(SHP_VARS.rendering.sampler_normals, 1);
    GL.bindBuffer(GL.ARRAY_BUFFER, QUAD_VERTEX);
    GL.vertexAttribPointer(SHP_VARS.rendering.position, 2, GL.FLOAT, false,8,0) ;
    GL.bindBuffer(GL.ELEMENT_ARRAY_BUFFER, QUAD_FACES);
    // Disable before switching shaders
    GL.disableVertexAttribArray(SHP_VARS.rendering.position);

    //SHADER PROGRAM GPGPU WATER INIT
    GL.useProgram(waterShader);
    GL.uniform1i(SHP_VARS.water.sampler_water, 0);
    GL.uniform1i(SHP_VARS.water.sampler_normals, 1);

    // SIMULATE A SQUARE WATER SURFACE SIDE MEASURING 2 METERS
    GL.uniform1f(SHP_VARS.water.g, -9.8);               //gravity acceleration
    GL.uniform1f(SHP_VARS.water.H, 0.01);               //mean height of water in meters
    GL.uniform1f(SHP_VARS.water.b, 0.001);                //viscous drag coefficient
    GL.uniform1f(SHP_VARS.water.epsilon, 1/SIMUSIZEPX); //used to compute space derivatives
    GL.uniform1f(SHP_VARS.water.scale, SIMUWIDTH/SIMUSIZEPX);
    // Set the water source flow and radius
    GL.uniform1f(SHP_VARS.water.sourceFlow, 4);
    GL.uniform1f(SHP_VARS.water.sourceRadius, 0.04); //percentage of the surface which is flowed by the source

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
      var dt = (timestamp - old_timestamp) / 1000; // time step in seconds;
      dt = Math.min(Math.abs(dt), 0.017);
      old_timestamp = timestamp;

      GL.clear(GL.COLOR_BUFFER_BIT);
      for (var i=0; i<GPGPU_NPASS; i++) {

        //COPY
        GL.bindFramebuffer(GL.FRAMEBUFFER, frameBuffer_copy);
        GL.useProgram(copyShader);
        GL.viewport(0.0, 0.0, SIMUSIZEPX, SIMUSIZEPX);
        GL.enableVertexAttribArray(SHP_VARS.copy.position);
        GL.bindTexture(GL.TEXTURE_2D, texture_water);
        GL.drawElements(GL.TRIANGLES, 6, GL.UNSIGNED_SHORT, 0);
        GL.disableVertexAttribArray(SHP_VARS.copy.position);

        // GPGPU PHYSICAL SIMULATION :
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
        GL.drawElements(GL.TRIANGLES, 6, GL.UNSIGNED_SHORT, 0);
        GL.disableVertexAttribArray(SHP_VARS.water.position);

        //NORMALS : compute normals from the water map
        GL.bindFramebuffer(GL.FRAMEBUFFER, frameBuffer_normals);
        GL.useProgram(normalShader);
        GL.enableVertexAttribArray(SHP_VARS.normals.position);
        GL.bindTexture(GL.TEXTURE_2D, texture_water);
        GL.drawElements(GL.TRIANGLES, 6, GL.UNSIGNED_SHORT, 0);
        GL.disableVertexAttribArray(SHP_VARS.normals.position);

      } // end of GPGPU_NPASS

      // RENDERING :
      GL.bindFramebuffer(GL.FRAMEBUFFER, null);
      GL.useProgram(renderShader);
      GL.enableVertexAttribArray(SHP_VARS.rendering.position);
      GL.viewport(0.0, 0.0, CANVAS.width, CANVAS.height);
      GL.activeTexture(GL.TEXTURE1);
      GL.bindTexture(GL.TEXTURE_2D, texture_normals);
      GL.activeTexture(GL.TEXTURE0);
      GL.bindTexture(GL.TEXTURE_2D, renderingTexture);
      GL.drawElements(GL.TRIANGLES, 6, GL.UNSIGNED_SHORT, 0);
      // Disable rendering attributes for next loop
      GL.disableVertexAttribArray(SHP_VARS.rendering.position);

      GL.flush();
      window.requestAnimationFrame(animate);
    };

    animate(new Date().getTime());
  };
