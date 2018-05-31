var main = function() {

    var CANVAS = document.getElementById("canvas");

    CANVAS.width = window.innerWidth;
    CANVAS.height = window.innerHeight;
    var GL = CANVAS.getContext("webgl");

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

    var SHP_VARS = {};
    SHP_VARS.rendering = {
      sampler: GL.getUniformLocation(renderShader, "sampler"),
      position: GL.getAttribLocation(renderShader, "position")
    }

    if (!GL.getProgramParameter(renderShader, GL.LINK_STATUS)) {
      alert("Failed to setup shaders");
    }

    GL.useProgram(renderShader);

    /* ----- THE QUAD ----- */
    // POINTS :
    var quad_vertex = [
      -1,-1,  // bottom left
       1,-1,  // bottom right
       1, 1,  // top right
      -1, 1,  // top left
    ];

    var QUAD_VERTEX= GL.createBuffer();
    GL.bindBuffer(GL.ARRAY_BUFFER, QUAD_VERTEX);
    GL.bufferData(GL.ARRAY_BUFFER,new Float32Array(quad_vertex),GL.STATIC_DRAW);

    //FACES:
    var quad_faces = [
      0,1,2,
      0,2,3,
    ];
    var QUAD_FACES= GL.createBuffer ();
    GL.bindBuffer(GL.ELEMENT_ARRAY_BUFFER, QUAD_FACES);
    GL.bufferData(GL.ELEMENT_ARRAY_BUFFER, new Uint16Array(quad_faces),GL.STATIC_DRAW);


    /* ----- THE TEXTURE ----- */

    var renderingImage = new Image();
    var imageURL = 'placeholder.jpg';
    renderingImage.src = imageURL;

    var renderingTexture = GL.createTexture();
    GL.pixelStorei(GL.UNPACK_FLIP_Y_WEBGL, true);


    GL.bindTexture(GL.TEXTURE_2D, renderingTexture);
    // Blue placeholder color
    GL.texImage2D(GL.TEXTURE_2D, 0, GL.RGBA, 1, 1, 0, GL.RGBA, GL.UNSIGNED_BYTE,
                  new Uint8Array([0, 0, 255, 255]));

    renderingImage.onload = function() {
      GL.bindTexture(GL.TEXTURE_2D, renderingTexture);
      GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MAG_FILTER, GL.LINEAR);
      GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MIN_FILTER, GL.LINEAR);
      GL.texImage2D(GL.TEXTURE_2D, 0, GL.RGBA, GL.RGBA, GL.UNSIGNED_BYTE, renderingImage);
    };


    /* ----- INIT ----- */

    // WEBGL GENERAL INIT
    GL.disable(GL.DEPTH_TEST);
    GL.disable(GL.SCISSOR_TEST);
    GL.clearColor(0.0, 0.0, 0.0, 0.0);


    // SHADER PROGRAM RENDERING INIT
    GL.useProgram(renderShader);
    GL.enableVertexAttribArray(SHP_VARS.rendering.position);
    GL.uniform1i(SHP_VARS.rendering.sampler, 0);
    GL.bindBuffer(GL.ARRAY_BUFFER, QUAD_VERTEX);
    GL.vertexAttribPointer(SHP_VARS.rendering.position, 2, GL.FLOAT, false,8,0) ;
    GL.bindBuffer(GL.ELEMENT_ARRAY_BUFFER, QUAD_FACES);

    /* ----- RENDER LOOP ----- */
    var old_timestamp = new Date().getTime();
    var animate = function(timestamp) {
      var dt = (timestamp - old_timestamp) / 1000; // time step in seconds;
      old_timestamp = timestamp;

      GL.clear(GL.COLOR_BUFFER_BIT);
      GL.viewport(0.0, 0.0, CANVAS.width, CANVAS.height);
      GL.bindTexture(GL.TEXTURE_2D, renderingTexture);
      GL.drawElements(GL.TRIANGLES, 6, GL.UNSIGNED_SHORT, 0);

      GL.flush();
      window.requestAnimationFrame(animate);
    };

    animate(new Date().getTime());
  };
