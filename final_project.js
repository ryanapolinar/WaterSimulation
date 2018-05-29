
var main=function() {

    var CANVAS=document.getElementById("canvas");
  
    CANVAS.width=window.innerWidth;
    CANVAS.height=window.innerHeight;
    var GL = CANVAS.getContext("webgl", {antialias: false, alpha: false});
  
  
    /*========================= RENDERING SHADERS ========================= */
    /*jshint multistr: true */
    var vertSrc_render="\n\
  attribute vec2 position;\n\
  \n\
  varying vec2 vUV;\n\
  \n\
  void main(void) {\n\
  gl_Position = vec4(position, 0., 1.);\n\
  vUV=0.5*(position+vec2(1.,1.));\n\
  }";
  
  
    var fragSrc_render="\n\
  precision highp float;\n\
  \n\
  uniform sampler2D sampler;\n\
  \n\
  varying vec2 vUV;\n\
  \n\
  void main(void) {\n\
  vec4 textureColor=texture2D(sampler, vUV);\n\
  gl_FragColor = textureColor;\n\
  }";
  
  
    //compile a shader :
    var get_shader=function(source, type, typeString) {
      var shader = GL.createShader(type);
      GL.shaderSource(shader, source);
      GL.compileShader(shader);
      if (!GL.getShaderParameter(shader, GL.COMPILE_STATUS)) {
        alert("ERROR IN "+typeString+ " SHADER : " + GL.getShaderInfoLog(shader));
        return false;
      }
      return shader;
    };
  
    //build a shader program :
    var get_shaderProgram=function(vertex_source, fragment_source, typeStr){
      var shader_vertex=get_shader(vertex_source, GL.VERTEX_SHADER, typeStr+" VERTEX");
      var shader_fragment=get_shader(fragment_source, GL.FRAGMENT_SHADER, typeStr+" FRAGMENT");
  
      var shader_program=GL.createProgram();
      GL.attachShader(shader_program, shader_vertex);
      GL.attachShader(shader_program, shader_fragment);
  
      GL.linkProgram(shader_program);
      return shader_program;
    };
  
  
    //final rendering shader program
    var SHP_VARS={};
    var SHP_RENDERING=get_shaderProgram(vertSrc_render, fragSrc_render, "RENDER");
  
    SHP_VARS.rendering={
      sampler: GL.getUniformLocation(SHP_RENDERING, "sampler"),
      position: GL.getAttribLocation(SHP_RENDERING, "position")
    };
  
  
    /*========================= THE QUAD ========================= */
    //POINTS :
    var quad_vertex=[
      -1,-1, //first corner: -> bottom left of the viewport
      1,-1,  //bottom right
      1,1,   //top right
      -1,1   //top left
    ];
  
    var QUAD_VERTEX= GL.createBuffer ();
    GL.bindBuffer(GL.ARRAY_BUFFER, QUAD_VERTEX);
    GL.bufferData(GL.ARRAY_BUFFER,new Float32Array(quad_vertex),GL.STATIC_DRAW);
  
    //FACES :
    var quad_faces = [0,1,2, 0,2,3];
    var QUAD_FACES= GL.createBuffer ();
    GL.bindBuffer(GL.ELEMENT_ARRAY_BUFFER, QUAD_FACES);
    GL.bufferData(GL.ELEMENT_ARRAY_BUFFER, new Uint16Array([0,1,2, 0,2,3]),GL.STATIC_DRAW);
  
  
    /*========================= THE TEXTURE ========================= */
  
    var renderingImage=new Image();
    renderingImage.src='placeholder.jpg';
  
    var renderingTexture=GL.createTexture();
    GL.pixelStorei(GL.UNPACK_FLIP_Y_WEBGL, true);
    GL.bindTexture(GL.TEXTURE_2D, renderingTexture);
  
    renderingImage.onload=function() {
      GL.bindTexture(GL.TEXTURE_2D, renderingTexture);
      GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MAG_FILTER, GL.LINEAR);
      GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MIN_FILTER, GL.LINEAR);
      GL.texImage2D(GL.TEXTURE_2D, 0, GL.RGBA, GL.RGBA, GL.UNSIGNED_BYTE, renderingImage);
    };
  
  
    /*========================= INIT ========================= */
  
    //WEBGL GENERAL INIT
    GL.disable(GL.DEPTH_TEST);
    GL.disable(GL.SCISSOR_TEST);
    GL.clearColor(0.0, 0.0, 0.0, 0.0);
  
  
    //SHADER PROGRAM RENDERING INIT
    GL.useProgram(SHP_RENDERING);
    GL.enableVertexAttribArray(SHP_VARS.rendering.position);
    GL.uniform1i(SHP_VARS.rendering.sampler, 0);
    GL.bindBuffer(GL.ARRAY_BUFFER, QUAD_VERTEX);
    GL.vertexAttribPointer(SHP_VARS.rendering.position, 2, GL.FLOAT, false,8,0) ;
    GL.bindBuffer(GL.ELEMENT_ARRAY_BUFFER, QUAD_FACES);
  
    /*========================= RENDER LOOP ========================= */
    var old_timestamp=new Date().getTime();
    var animate=function(timestamp) {
      var dt=(timestamp-old_timestamp)/1000; //time step in seconds;
      old_timestamp=timestamp;
  
      GL.clear(GL.COLOR_BUFFER_BIT);
      GL.viewport(0.0, 0.0, CANVAS.width, CANVAS.height);
      GL.bindTexture(GL.TEXTURE_2D, renderingTexture);
      GL.drawElements(GL.TRIANGLES, 6, GL.UNSIGNED_SHORT, 0);
  
      GL.flush();
      window.requestAnimationFrame(animate);
    };
  
    animate(new Date().getTime());
  };