/** 
 *  Compute differences to cut the background
*/

/**
 * CvRender - render object, handles cv processes and parameters
 */
class CvRender {
	constructor (canvasContext) {
		this.canvasContext = canvasContext;
	}
	convolutionFrame = function (bitmap, window, x, y, maxW, maxY) {
		console.log(window, x, y, maxW, maxY);
	}

	setCanvasContext(width, height) {
		const testCanvas = document.querySelector('[render="test"]');
		const testContext = testCanvas.getContext('2d');
		this.testContext = testContext;
		testCanvas.width = width;
		testCanvas.height = height;
		testCanvas.style.width = Math.round(width * 1) + 'px';
		testCanvas.style.height = Math.round(height * 1) + 'px';
		testCanvas.style.backgroundColor = 'transparent';
	}

	set mask(bitmap) {
		this.mask = bitmap;
	}
	set	initialFrame(bitmap) {
		this.initial = bitmap;
	}
	async segmentBackground(imagebitmap, imageCapture, width, height) {
		const testContext = this.testContext;
		const canvasContext = this.canvasContext;
		return new Promise(async function (resolve, reject) {
			// const img = await imageCapture.takePhoto();
			// console.log(ImageData.fromBlob(img));
			// const buffer = await img.arrayBuffer();
			// console.log(new Uint8ClampedArray(buffer));
			//console.log(img);
			requestAnimationFrame(function () {

				testContext.drawImage(imagebitmap, 0, 0);
				const imagedata = testContext.getImageData(0, 0, width, height);
				// console.log(imagedata.data);
				testContext.clearRect(0, 0, width, height);
				for (let p = 0; p < imagedata.data.length; p += 4) {
					let x = Math.round(((p / 4) + 1) % width);
					let y = Math.round(((p / 4) + 1) / width) + 1;
					const vector = imagedata.data.slice(p, p + 4);
					// console.log(vector);
					let isWhite = vector[0] < 130 && vector[1] > 80 && vector[2] > 80;
					if (isWhite) {
						vector[0] = '255';
						vector[1] = '255';
						vector[2] = '255';
					} else {
						vector[3] = 0;
					}
					testContext.fillStyle = 'rgba(' + vector[0]
						+ ',' + vector[1]
						+ ',' + vector[2]
						+ ',' + (vector[3]/255) + ')';
					testContext.fillRect(x, y, 1, 1);
				}
				let windowSize = Math.round(width / 6);
				resolve(true);
			});
		});
	}
}