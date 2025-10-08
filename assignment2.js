import vertexShaderSrc from './vertex.glsl.js';
import fragmentShaderSrc from './fragment.glsl.js'

var gl = null;
var vao = null;
var program = null;
var vertexCount = 0;
var uniformModelViewLoc = null;
var uniformProjectionLoc = null;
var heightmapData = null;

const xSlider = document.getElementById('xrotation');
const ySlider = document.getElementById('yrotation');
const zSlider = document.getElementById('zrotation');
const zoomSlider = document.getElementById('zoom');
const xtranslateSlider = document.getElementById('xtranslate');
const ytranslateSlider = document.getElementById('ytranslate');
const heightSlider = document.getElementById('height');



function processImage(img) {
    // draw the image into an off-screen canvas
    var off = document.createElement('canvas');
    
    var sw = img.width, sh = img.height;
    off.width = sw; off.height = sh;
    
    var ctx = off.getContext('2d');
    ctx.drawImage(img, 0, 0, sw, sh);
    
    // read back the image pixel data
    var imgd = ctx.getImageData(0,0,sw,sh);
    var px = imgd.data;
    
    // create a an array will hold the height value
    var heightArray = new Float32Array(sw * sh * 3);

    // loop through the image, rows then columns
    for (var y = 0; y < sh; y++) {
        for (var x = 0; x < sw; x++) {
            // offset in the image buffer
            var i = (y * sw + x) * 4;
            
            var r = px[i+0], g = px[i+1], b = px[i+2];
            
            // convert to greyscale value between 0 and 1
            var lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255.0;

            var baseIndex = (y * sw + x) * 3;

            // Map pixel x-coordinate [0, sw-1] to [-1, 1]
            heightArray[baseIndex]     = (x / (sw - 1)) * 2.0 - 1.0;
            // Map pixel y-coordinate [0, sh-1] to [-1, 1]
            heightArray[baseIndex + 1] = (y / (sh - 1)) * 2.0 - 1.0;
            // Height (lum) is already [0, 1], which is a perfect normalized range.
            heightArray[baseIndex + 2] = lum;
        }
    }

    return {
        data: heightArray,
        width: sw,
        height: sh
    };
}

window.loadImageFile = function(event)
{

	var f = event.target.files && event.target.files[0];
	if (!f) return;
	
	// create a FileReader to read the image file
	var reader = new FileReader();
	reader.onload = function() 
	{
		// create an internal Image object to hold the image into memory
		var img = new Image();
		img.onload = function() 
		{
			// heightmapData is globally defined
			heightmapData = processImage(img);
            var vertices = heightmapData.data;
            var sw = heightmapData.width;
            var sh = heightmapData.height;
            
            var positions = [];

            for (var y = 0; y < sh - 1; y++) {
                for (var x = 0; x < sw - 1; x++) {
                    // Indices of the four vertices forming a quad
                    var v1_idx = (y * sw + x) * 3;
                    var v2_idx = (y * sw + (x + 1)) * 3;
                    var v3_idx = ((y + 1) * sw + x) * 3;
                    var v4_idx = ((y + 1) * sw + (x + 1)) * 3;

                    // First triangle of the quad
                    positions.push(vertices[v1_idx], vertices[v1_idx+1], vertices[v1_idx+2]);
                    positions.push(vertices[v2_idx], vertices[v2_idx+1], vertices[v2_idx+2]);
                    positions.push(vertices[v3_idx], vertices[v3_idx+1], vertices[v3_idx+2]);

                    // Second triangle of the quad
                    positions.push(vertices[v2_idx], vertices[v2_idx+1], vertices[v2_idx+2]);
                    positions.push(vertices[v4_idx], vertices[v4_idx+1], vertices[v4_idx+2]);
                    positions.push(vertices[v3_idx], vertices[v3_idx+1], vertices[v3_idx+2]);
                }
            }
            
            vertexCount = positions.length / 3;     // vertexCount is global variable used by draw()

            // create buffers to put in box
            var posVertices = new Float32Array(positions);
            var posBuffer = createBuffer(gl, gl.ARRAY_BUFFER, posVertices);

            // attributes (per vertex)
            var posAttribLoc = gl.getAttribLocation(program, "position");

            vao = createVAO(gl, 
                // positions
                posAttribLoc, posBuffer, 

                // normals (unused in this assignments)
                null, null, 

                // colors (not needed--computed by shader)
                null, null
            );
			console.log('loaded image: ' + heightmapData.width + ' x ' + heightmapData.height);

		};
		img.onerror = function() 
		{
			console.error("Invalid image file.");
			alert("The selected file could not be loaded as an image.");
		};

		// the source of the image is the data load from the file
		img.src = reader.result;
	};
	reader.readAsDataURL(f);
}


function setupViewMatrix(eye, target)
{
    var forward = normalize(subtract(target, eye));
    var upHint  = [0, 1, 0];

    var right = normalize(cross(forward, upHint));
    var up    = cross(right, forward);

    var view = lookAt(eye, target, up);
    return view;

}
function draw()
{

	var fovRadians = 70 * Math.PI / 180;
	var aspectRatio = +gl.canvas.width / +gl.canvas.height;
	var nearClip = 0.001;
	var farClip = 20.0;

	// perspective projection
	var projectionMatrix = perspectiveMatrix(
		fovRadians,
		aspectRatio,
		nearClip,
		farClip,
	);

	// eye and target
	var eye = [0, 5, 5];
	var target = [0, 0, 0];

	var modelMatrix = identityMatrix();

	var initXRot = rotateXMatrix(90 * Math.PI / 180)
	var rotX = rotateXMatrix(xSlider.value * Math.PI / 180)
	var rotY = rotateYMatrix(ySlider.value * Math.PI / 180)
	var rotZ = rotateZMatrix(zSlider.value * Math.PI / 180)

	const zoom = zoomSlider.value / 10 + 1
	var scaleMat = scaleMatrix(zoom ,zoom, zoom);

	const xtranslate = xtranslateSlider.value / 10
	var xtransMat = translateMatrix(xtranslate, 0, 0);

	const ytranslate = ytranslateSlider.value / 10
	var ytransMat = translateMatrix(0, ytranslate, 0);
	
	modelMatrix = multiplyMatrices(initXRot, modelMatrix);
	modelMatrix = multiplyMatrices(rotX, modelMatrix);
	modelMatrix = multiplyMatrices(rotY, modelMatrix);
	modelMatrix = multiplyMatrices(rotZ, modelMatrix);
	modelMatrix = multiplyMatrices(scaleMat, modelMatrix);
	modelMatrix = multiplyMatrices(xtransMat, modelMatrix);
	modelMatrix = multiplyMatrices(ytransMat, modelMatrix);

	// setup viewing matrix
	var eyeToTarget = subtract(target, eye);
	var viewMatrix = setupViewMatrix(eye, target);

	// model-view Matrix = view * model
	var modelviewMatrix = multiplyMatrices(viewMatrix, modelMatrix);

	// enable depth testing
	gl.enable(gl.DEPTH_TEST);

	// disable face culling to render both sides of the triangles
	gl.disable(gl.CULL_FACE);

	gl.clearColor(0.2, 0.2, 0.2, 1);
	gl.clear(gl.COLOR_BUFFER_BIT);

	gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
	gl.useProgram(program);
	
	// update modelview and projection matrices to GPU as uniforms
	gl.uniformMatrix4fv(uniformModelViewLoc, false, new Float32Array(modelviewMatrix));
	gl.uniformMatrix4fv(uniformProjectionLoc, false, new Float32Array(projectionMatrix));

	gl.bindVertexArray(vao);
	
	var primitiveType = gl.TRIANGLES;
	gl.drawArrays(primitiveType, 0, vertexCount);

	requestAnimationFrame(draw);

}

function createBox()
{
	function transformTriangle(triangle, matrix) {
		var v1 = [triangle[0], triangle[1], triangle[2], 1];
		var v2 = [triangle[3], triangle[4], triangle[5], 1];
		var v3 = [triangle[6], triangle[7], triangle[8], 1];

		var newV1 = multiplyMatrixVector(matrix, v1);
		var newV2 = multiplyMatrixVector(matrix, v2);
		var newV3 = multiplyMatrixVector(matrix, v3);

		return [
			newV1[0], newV1[1], newV1[2],
			newV2[0], newV2[1], newV2[2],
			newV3[0], newV3[1], newV3[2]
		];
	}

	var box = [];

	var triangle1 = [
		-1, -1, +1,
		-1, +1, +1,
		+1, -1, +1,
	];
	box.push(...triangle1)

	var triangle2 = [
		+1, -1, +1,
		-1, +1, +1,
		+1, +1, +1
	];
	box.push(...triangle2);

	// 3 rotations of the above face
	for (var i=1; i<=3; i++) 
	{
		var yAngle = i* (90 * Math.PI / 180);
		var yRotMat = rotateYMatrix(yAngle);

		var newT1 = transformTriangle(triangle1, yRotMat);
		var newT2 = transformTriangle(triangle2, yRotMat);

		box.push(...newT1);
		box.push(...newT2);
	}

	// a rotation to provide the base of the box
	var xRotMat = rotateXMatrix(90 * Math.PI / 180);
	box.push(...transformTriangle(triangle1, xRotMat));
	box.push(...transformTriangle(triangle2, xRotMat));


	return {
		positions: box
	};

}

var isDragging = false;
var startX, startY;
var leftMouse = false;

function addMouseCallback(canvas)
{
	isDragging = false;

	canvas.addEventListener("mousedown", function (e) 
	{
		if (e.button === 0) {
			console.log("Left button pressed");
			leftMouse = true;
		} else if (e.button === 2) {
			console.log("Right button pressed");
			leftMouse = false;
		}

		isDragging = true;
		startX = e.offsetX;
		startY = e.offsetY;
	});

	canvas.addEventListener("contextmenu", function(e)  {
		e.preventDefault(); // disables the default right-click menu
	});


	canvas.addEventListener("wheel", function(e)  {
		e.preventDefault(); // prevents page scroll

		if (e.deltaY < 0) 
		{
			console.log("Scrolled up");
			// e.g., zoom in
		} else {
			console.log("Scrolled down");
			// e.g., zoom out
		}
	});

	document.addEventListener("mousemove", function (e) {
		if (!isDragging) return;
		var currentX = e.offsetX;
		var currentY = e.offsetY;

		var deltaX = currentX - startX;
		var deltaY = currentY - startY;
		console.log('mouse drag by: ' + deltaX + ', ' + deltaY);

		// implement dragging logic
	});

	document.addEventListener("mouseup", function () {
		isDragging = false;
	});

	document.addEventListener("mouseleave", () => {
		isDragging = false;
	});
}

function initialize() 
{
	var canvas = document.querySelector("#glcanvas");
	canvas.width = canvas.clientWidth;
	canvas.height = canvas.clientHeight;

	gl = canvas.getContext("webgl2");

	// add mouse callbacks
	addMouseCallback(canvas);

	var box = createBox();
	vertexCount = box.positions.length / 3;		// vertexCount is global variable used by draw()
	console.log(box);

	// create buffers to put in box
	var boxVertices = new Float32Array(box['positions']);
	var posBuffer = createBuffer(gl, gl.ARRAY_BUFFER, boxVertices);

	var vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSrc);
	var fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSrc);
	program = createProgram(gl, vertexShader, fragmentShader);

	// attributes (per vertex)
	var posAttribLoc = gl.getAttribLocation(program, "position");

	// uniforms
	uniformModelViewLoc = gl.getUniformLocation(program, 'modelview');
	uniformProjectionLoc = gl.getUniformLocation(program, 'projection');

	vao = createVAO(gl, 
		// positions
		posAttribLoc, posBuffer, 

		// normals (unused in this assignments)
		null, null, 

		// colors (not needed--computed by shader)
		null, null
	);

	window.requestAnimationFrame(draw);
}

window.onload = initialize();