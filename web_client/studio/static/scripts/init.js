function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
let worker;
let file;
let play = false;
let segmentation = false;
let capturing = false;
const scale = 0.6;
let dim = {};
let cameraCanvas = {};
let trainContext;
let trainData;
let mask;


function drawSilhouette (context, width, height, image) {
	context.clearRect(0, 0, width, height);
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const pos = (width * y) + x;
			if (image[pos] > 0) {
				let pixelColor = `rgba(255, 100, 80, 0.4)`;
				context.fillStyle = pixelColor;
				context.fillRect(x, y, 1, 1);
			}
		}
	}
}


async function capture(stream, width, height) {
	dim.width = width;
	dim.height = height;
	const controls = document.querySelector('[container="controls"]');
	controls.style.marginTop = Math.round((height * scale) / 2) + 'px';
	const canvas = document.querySelector('[render="video"]');
	cameraCanvas.canvas = canvas;
	canvas.style.width = Math.round(width * scale) + 'px';
	canvas.style.height = Math.round(height * scale) + 'px';
	canvas.width = width;
	canvas.height = height;
	const context = canvas.getContext('2d');
	cameraCanvas.context = context;
	const testCanvas = document.querySelector('[render="test"]');
	testCanvas.width = width;
	testCanvas.height = height;
	testCanvas.style.width = Math.round(width * scale) + 'px';
	testCanvas.style.height = Math.round(height * scale) + 'px';
	testCanvas.style.left = Math.round(width * scale + 10) + 'px';
	testCanvas.style.backgroundColor = 'transparent';
	const testContext = testCanvas.transferControlToOffscreen();

	const settings = {
		width: width,
		height:height,
	};
	worker = new Worker('../static/scripts/canvas_worker.js');
	worker.postMessage({canvas2: testContext}, [testContext])
	worker.postMessage({'opt': 'settings', 'settings': settings});
	worker.postMessage({'opt': 'new_net', 'dataset': 'learned'});
	const track = stream.getTracks()[0];
	const imageCapture = new ImageCapture(track);
	let count = 0;
	let FPS = track.getSettings().frameRate;
	const trainCanvas = document.querySelector('[render="train"]');
	trainCanvas.width = Math.round(dim.width);
	trainCanvas.height = Math.round(dim.height);
	trainCanvas.style.width = Math.round(dim.width * scale) + 'px';
	trainCanvas.style.height = Math.round(dim.height * scale) + 'px';
	trainContext = trainCanvas.transferControlToOffscreen();
	if (file) {
		const trainImgFetch = await fetch(
			`http://localhost:6089/processes/train/${file.name}`
		);
		trainData = await trainImgFetch.json();
		let maskW = trainData.mask.size[0];
		let maskH = trainData.mask.size[1];
		mask = await extractImageBitmap(trainData.mask.data, maskW, maskH);
		drawSilhouette(trainContext.getContext('2d'), width, height, mask);
		// console.log(trainData);
	}
	while (play) {
		const imageBitmap = await imageCapture.grabFrame();
		cameraCanvas.imageBitmap = imageBitmap;
		context.drawImage(imageBitmap, 0, 0);
		if (capturing) {
			let image = canvas.toDataURL("image/png").replace("image/png", "image/octet-stream");
			window.location.href = image;
			capturing = false;
		}
	}
	stream.getTracks().forEach(tr => tr.stop());
}
async function runSegmentation () {
	console.log(cameraCanvas.imageBitmap, mask, trainContext);
	worker.postMessage({
		'opt': 'segment',
		'dataset': 'learned',
		'img': cameraCanvas.imageBitmap,
		// 'train': mask,
		'trainContext': trainContext
	}, [cameraCanvas.imageBitmap, trainContext]);// mask, trainContext]);
	worker.addEventListener('message', async function (msg) {
		// console.log(imageBitmap);
		if (file) {
			let maskW = trainData.mask.size[0];
			let maskH = trainData.mask.size[1];
			mask = await extractImageBitmap(trainData.mask.data, maskW, maskH);
		} else {
			mask = null;
		}
		worker.postMessage({
			'opt': 'train_features',
			'dataset': 'learned',
			'img': cameraCanvas.imageBitmap,
			'train': mask,
		}, [cameraCanvas.imageBitmap, mask]);

	});
}
async function extractImageBitmap(data, width, height) {
	const cnv = document.createElement('canvas');
	cnv.width = width;
	cnv.height = height;
	cnv.style.width = width + 'px';
	cnv.style.height = height + 'px';
	const ctx = cnv.getContext('2d');
	const imData = ctx.createImageData(width, height);
	imData.data.set(data);
	let image1 = await createImageBitmap(imData, 0, 0, width, height);
	return image1;
}


async function runTrain () {
	console.log(file);
	// Reuest a list of files to run the training dataset on
	const listReq = await fetch(
		`http://localhost:6089/processes/train/files`
	);
	const list = await listReq.json();
	console.log(list);
	// Request the data for the image to extract the features 
	const trainingImageFetch = await fetch(
		`http://localhost:6089/processes/train/${file.name}`
	);
	const trainingImage = await trainingImageFetch.json();
	let width = trainingImage.source.size[0];
	let height = trainingImage.source.size[1];

	// Initializes the canvas context for the service-worker

	const camCanvas = document.querySelector('[render="video"]');
	camCanvas.width = Math.round(width);
	camCanvas.height = Math.round(height);
	camCanvas.style.width = Math.round(width * scale) + 'px';
	camCanvas.style.height = Math.round(height * scale) + 'px';

	const testCanvas = document.querySelector('[render="test"]');
	testCanvas.width = width;
	testCanvas.height = height;
	testCanvas.style.width = Math.round(width * scale) + 'px';
	testCanvas.style.height = Math.round(height * scale) + 'px';
	testCanvas.style.left = Math.round(width * scale + 10) + 'px';
	testCanvas.style.backgroundColor = 'transparent';
	const testContext = testCanvas.transferControlToOffscreen();

	const trainCanvas = document.querySelector('[render="train"]');
	trainCanvas.width = Math.round(width);
	trainCanvas.height = Math.round(height);
	trainCanvas.style.width = Math.round(width * scale) + 'px';
	trainCanvas.style.height = Math.round(height * scale) + 'px';
	trainCanvas.style.left = Math.round((width * scale) * 2 + 20) + 'px';
	trainContext = trainCanvas.transferControlToOffscreen();

	const settings = {
		width: width,
		height: height,
	};
	worker = new Worker('../static/scripts/canvas_worker.js');
	worker.postMessage({canvas2: testContext}, [testContext])
	worker.postMessage({'opt': 'settings', 'settings': settings});
	// ---------------------------------------------------------
	// Extract image bitmap for the worker
	let image1 = await extractImageBitmap(trainingImage.source.data, width, height);
	const camContext = camCanvas.getContext('2d');
	console.log(camContext, image1);
	
	camContext.drawImage(image1, 0, 0);
	let maskW = trainingImage.mask.size[0];
	let maskH = trainingImage.mask.size[1];
	let image2 = await extractImageBitmap(trainingImage.mask.data, maskW, maskH);
	console.log(image1, image2);
	// Messages for CV
	// 'train_features'
	// 'extract_features'
	// 'segment'
	const opt = 'extract_features';
	worker.postMessage({
		'opt': opt,
		'dataset': 'learned',
		'img': image1,
		'train': image2,
		'trainContext': trainContext
	}, [image1, image2, trainContext]);
	let pos = 0;
	let extractlimit = 15;
	let extractedCount = 0;
	worker.addEventListener('message', async function (msg) {
		if (pos < list.length) {
			const source = list[pos];
			console.log(source, 'left:', list.length  - pos);
			const trainImgFetch = await fetch(
				`http://localhost:6089/processes/train/${source}`
			);
			const trainImg = await trainImgFetch.json();
			const trainImageBitmap = await extractImageBitmap(trainImg.source.data, width, height);
			camContext.drawImage(trainImageBitmap, 0, 0);
			let maskW = trainImg.mask.size[0];
			let maskH = trainImg.mask.size[1];
			let maskBitmap = await extractImageBitmap(trainImg.mask.data, maskW, maskH);
			const extReq = await fetch(
				`http://localhost:6089/processes/extracted`
			)
			const extracted = await extReq.json();
			let ext = false;
			for (const filter of extracted) {
				if (filter === source) {
					ext = true;
				}
			}
			let operation = 'train_features';
			if (ext === false && extractedCount < extractlimit) {
				operation = 'extract_features';
				extractedCount++;
				const extReqPOST = await fetch(
					`http://localhost:6089/processes/extracted`,
					{
						method: 'POST',
						body: JSON.stringify({
							extracted: source
						}),
						headers: {
							'Content-type': 'application/json'
						}
					}
				)
				const extRes = await extReqPOST.json();
				console.log(extRes);
			}
			console.log(operation);
			worker.postMessage({
				'opt': operation,
				'dataset': 'learned',
				'img': trainImageBitmap,
				'train': maskBitmap,
			}, [trainImageBitmap, maskBitmap]);
		}
		pos++;
	});
	await sleep(20000);
	// init the loop to train the model
}
function uploadFile (evn) {
	file = evn[0];
}
window.onload = async function (evn) {
	const editor = new Editor(['https://video.1', 'https://video.2']);
	editor.appendTo(document.body);
	// const startBtn = document.querySelector('[action="start"]');
	// const picture = document.querySelector('[action="picture"]');
	// const segment = document.querySelector('[action="segment"]');
	// const train = document.querySelector('[action="train"]');
	// const stopBtn = document.querySelector('[action="stop"]');
	// let stream;
	// startBtn.addEventListener('click', async function () {
	// 	play = true;
	// 	stream = await navigator.mediaDevices.getUserMedia({video: true, audio: false});
	// 	let{width, height} = stream.getTracks()[0].getSettings();
	// 	console.log(width, height);
	// 	capture(stream, width, height);
	// });
	// picture.addEventListener('click', function () {
	// 	capturing = true;
	// });
	// segment.addEventListener('click', function () {
	// 	runSegmentation();
	// });
	// stopBtn.addEventListener('click', function (evn) {
	// 	play = false;
	// 	segmentation = false;
	// });
	// train.addEventListener('click', async function () {
	// 	runTrain();
	// });
}