/**
 * Net Raise layers modeling
 * Service Worker - handle the layers architecture and the interface with the client
 * to perform training, segmentation and testing tasks
 * @settings - to set the CNN configuration
 * @rendering - to avoid overlap rendering processes
 * @render - Reference to an Instance of the convolutional network
 * @trainContext - canvas offscreen context to visualize training process
 * @testContext - canvas offscreen context to visualize testing process
 */

let settings = {};
let rendering = false;
let render;
let trainContext;
let testContext;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
/**
 * Worker.onmessage - get the client instructions to contruct the network
 * a pass training and testing data
 */
self.onmessage = async function (msg) {
	if ('canvas2' in msg.data) {
		this.console.log(msg.data.canvas2);
		settings.cv2 = msg.data.canvas2;
	}
	if ('opt' in msg.data) {
		switch (msg.data.opt) {
			/**Set the dimensions for a new ConvNet, also the canvas context to render*/
			case 'settings':
				settings.width = msg.data.settings.width;
				settings.height = msg.data.settings.height;
				settings.ctx2 = settings.cv2.getContext('2d');
				render = new ConvNet(settings.ctx1);
				render.test_context = settings.ctx2;
				break;
			/**Load the filters from the dataset */
			case 'new_net':
				await render.loadFilters(msg.data.dataset);
				break;
			/** Performs a sergmentation task*/
			case 'segment':
				if (rendering === false) {
					rendering = true;
					if (msg.data.trainContext) {
						settings.trainContext = msg.data.trainContext;
					}
					render.segmentBackground(
						msg.data.img,
						settings.width, settings.height,
						null, null,
						null,
						msg.data.dataset);
				}
				break;
				// imagebitmap,
				// width, height,
				// trainData, trainContext,
				// extract, dataset) {
			/** Perform feature extraction */
			case 'extract_features':
				if (rendering === false) {
					rendering = true;
					if (msg.data.trainContext) {
						settings.trainContext = msg.data.trainContext;
					}
					render.segmentBackground(
						msg.data.img,
						settings.width, settings.height,
						msg.data.train, settings.trainContext,
						true,
						msg.data.dataset);
				}
				break;
			/** Perform training task */
			case 'train_features':
				if (rendering === false) {
					rendering = true;
					if (msg.data.trainContext) {
						settings.trainContext = msg.data.trainContext;
					}
					render.segmentBackground(
						msg.data.img,
						settings.width,
						settings.height,
						msg.data.train,
						settings.trainContext,
						false,
						msg.data.dataset);
				}
				break;
			default:
				throw 'no option given to cv worker'
		}
	}
}
/**
 * SendTriningREsults - send the new weights to the server to be stored
 * @param {Boolean} extract - determines if send scores or the extracted images
 * @param {Array} data - the data to be sent List of features || lista de scores
 * @param {String} uri 
 */
async function sendTrainigResults(extract, data, uri) {
	if (extract === true) {
		// ---------------save learned features ------------------------------------------------
		// console.log(inputLayer.learnedFeatures);
		const req = await fetch(`http://localhost:6089/filters/${uri}`, {
			method: 'POST',
			body: JSON.stringify(data),
			headers: {
				'Content-type': 'application/json; charset=UTF-8'
			}
		});
		const res = await req.json();
		return res;
		// -------------------------------------------------------------------------------------
	} else if (extract === false){
		// ---------------save scores ---------------------------------------------------------
		// console.log(coords);
		const req = await fetch(
			`http://localhost:6089/filters/${uri}/scores`,
			{
				method: 'POST',
				body: JSON.stringify(
					data
				),
				headers: {
					'Content-type': 'application/json; charset=UTF-8'
				}
			}
		)
		const res = await req.json();
		return res;

	}
}
/**
 * drawSilhouette - define the separation line between
 * the classes in the training data
 * @param {*} context 
 * @param {*} width 
 * @param {*} height 
 * @param {*} image 
 */
function drawSilhouette (context, width, height, image) {
	context.clearRect(0, 0, width, height);
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const pos = (width * y) + x;
			if (image[pos] > 0) {
				let pixelColor = `rgba(${image[pos]}, ${image[pos + 1]}, ${image[pos + 2]}, 0.2)`;
				context.fillStyle = pixelColor;
				context.fillRect(x, y, 1, 1);
			}
		}
	}
}
/**
 * Filters - Initializes a filters list with it's corresponding data info
 */
class Filters {
	/**
	 * constructor - stablish the dataset string in the object
	 * @param {String} dataset the filter's dataset name
	 */
	constructor (dataset) {
		this._dataset = dataset;
	}
	/**
	 * dataset - getter
	 * @return {Array} the list of filter for the corresponding dataset
	 */
	get dataset () {
		return this._dataset;
	}
	/**
	 * init - request for the dataset filters from server
	 * @property {Array} this.filters
	 */
	async init () {
		const req = await fetch(`http://localhost:6089/filters/${this.dataset}/all`, {method: 'GET'});
		const reqFilters = await req.json();
		this.filters = reqFilters;
	}
}
/**
 * Layer Settings - set the layer's HyperParameters
 */
class LayerSettings {
	/**
	 * constructor - set the properties
	 * @param {Number} stride
	 * @param {Number} depth 
	 * @param {Object} inputSettings 
	 * @param {Object} filters 
	 */
	constructor(stride, depth, inputSettings, filters) {
		this.stride = stride;
		this.filterWidth = filters.filters[0].width;
		this.filters = filters;
		this.depth = depth;
		this.inputSettings = inputSettings;
	}
	/**
	 * get - obtain directly a property from a LayerSettings instance
	 * @param {Object} property any type
	 */
	get (property) {
		return this[property];
	}
	/**
	 * set - set directly a property to the LayerSettings instance
	 * @param {Object} property any type
	 */
	set (property, value) {
		this[property] = value;
	}
}
/**
 * Conv2D - defines a convolutional layer it's methods and properties
 */
class Conv2D {
	/**
	 * 
	 * @param {RGBA Array} input the activation map or the original image
	 * @param {RGBA Array} weights filters for this layer
	 * @param {Object} trainData contains (canvas, [RGBA])
	 * @param {LayerSettings} settings
	 */
	constructor(input, weights, trainData, settings) {
		this.input = input;
		this.trainData = trainData;
		this.settings = settings;
		this.weights = weights;
		this._learnedFeatures = [];
	}
	/**
	 * learnedFeatures - getter
	 * @returns {_learnedFeatures}
	 */
	get learnedFeatures () {
		return this._learnedFeatures;
	}
	/**
	 * canvas - sets the canvas context to draw convolutional process
	 * @context {OffScreen context}
	 */
	set canvas (context) {
		this._ctx = context
	}
	/**
	 * setWeight - sets a weight new value
	 * @param {Number} index position in weigths
	 * @param {*} value value to set
	 */
	setWeight(index, value) {
		this.weights[index] = value;
	}
	/**
	 * run - initialize the convoultional process according 
	 * to the setted parameters
	 * @returns {Activation Map} a map of the same width and heigth and deep
	 * according to the filters length
	 */
	run = async function () {
		const stride = this.settings.filterWidth;
		const width = this.settings.filterWidth;
		const depth = this.settings.depth;
		const [wid, height] = this.settings.get('inputSettings');
		const activationMaps = Array.from({
			length: this.settings.filters.filters.length
		}, e => []);
		const output = {
			'test': this.settings.filters.filters[0].name
		};
		output['coords'] = [];
		let mapW = 0;
		let mapH = 0;
		let processedPixels = 0;
		for (let y = 0; y < height; y += Math.round(stride)) {
			mapH += 1
			mapW = 0;
			for (let x = 0; x < wid; x += Math.round(stride)) {
				mapW += 1;
				processedPixels += 1;
				const res = this.processWindow(x, y);
				for (let pos = 0; pos < activationMaps.length; pos++) {
					// console.log(res.map[pos]);
					// console.log(pos);
					// console.log(activationMaps[pos]);
					// activationMaps[pos][0] += res.map[pos].length;
					// console.log(res.map[pos].length);
					for (const val of res.map[pos]) {
						activationMaps[pos].push(val);
					}
				}
			}
		}
		console.log(mapW, mapH, processedPixels);
		drawMaps(activationMaps, this._ctx, {
			width: mapW,
			height: mapH
		});
		return activationMaps;
	}
	/**
	 * processWindow - apply the convolutional operation
	 * to a segment of the input
	 * @param {Number} x initial position
	 * @param {Number} y initial position
	 */
	processWindow(x, y) {
		let activationMaps = Array.from({
			length: this.settings.filters.filters.length
		}, e => Array(4).fill(0));
		let filterPosition = 0;
		const [wid, height] = this.settings.get('inputSettings');
		for (let yPoint = y; yPoint < y + this.settings.filterWidth; yPoint++) {
			for (let xPoint = x; xPoint < x + this.settings.filterWidth; xPoint++) {
				try {
					// Extract a vector for the input pixel
					const pos = (wid * yPoint) + xPoint;
					const vector = [
						this.input[(pos * 4)] / 255,
						this.input[(pos * 4) + 1] / 255,
						this.input[(pos * 4) + 2] / 255,
						this.input[(pos * 4) + 3] / 255,
					]
					let bk = false;
					for (const val of vector) {
						if (isNaN(val)) {
							bk = true;
							break;
						}
					}
					if (bk) {
						break;
					}
					for (let i = 0; i < this.settings.filters.filters.length ; i++) {
						const filter = this.settings.filters.filters[i];
						const fPos = Math.round((filterPosition));
						let v1 = (filter.data[fPos] / 255) * vector[0];
						let v2 = (filter.data[fPos + 1] / 255) * vector[1];
						let v3 = (filter.data[fPos + 2] / 255) * vector[2];
						let test = [v1, v2, v3];
						for (const t of test) {
							if (isNaN(t)) {
								console.log('failed');
							}
						}
						activationMaps[i][0] += v1;
						activationMaps[i][1] += v2;
						activationMaps[i][2] += v3;
						// activationMaps[i][0] += filter.data[fPos + 3] * vector[3];
					}
					filterPosition += 4;
				} catch (err) {
					console.log(err);
					break;
				}
			}
		}
		// console.log(activationMaps);
		for (let i = 0; i < activationMaps.length; i++) {
			let factor = this.settings.filterWidth ** 2;
			for (let chan = 0; chan < 3; chan++) {
				let val = activationMaps[i][chan] / factor;
				if (isNaN(val)) {
					console.log('isNaN', activationMaps[i][chan], factor);
					break;
				}
				activationMaps[i][chan] = val;
			}
			activationMaps[i][3] = 255;
		}
		// console.log(activationMaps);
		return {
				'color': 'red',
				'map': activationMaps,
				'value': 1
			}
	}
}
async function drawMaps(maps, context, dimensions) {
	console.log(maps);
	context.canvas.width = dimensions.width;
	context.canvas.height = dimensions.height;
	let imageData = context.getImageData(0, 0, dimensions.width, dimensions.height);
	let data = imageData.data;
	for (let mIndex = 0; mIndex < maps.length; mIndex++) {
		const map = maps[mIndex];
		for (let i = 0; i < map.length; i++) {
			if (map[i] !== 255) {
				data[i] = Math.round(map[i] * 255);
			} else {
				data[i] = 255;
			}
		}
		context.putImageData(imageData, 0, 0);
		console.log('Map: ', mIndex);
		await sleep(500);
	}
	
}
class ConvNet {
	constructor (canvasContext) {
		this.canvasContext = canvasContext;
		this._model = {}
	}

	set test_context (context) {
		this.testContext = context;
	}

	set mask (bitmap) {
		this.mask = bitmap;
	}
	set	initialFrame (bitmap) {
		this.initial = bitmap;
	}

	async loadFilters (dataset) {
		this._filters = [];
		this._filters.push(new Filters(dataset + '-17'));
		await this._filters[0].init();
		this._filters.push(new Filters(dataset + '-68'));
		await this._filters[1].init();
	}

	async segmentBackground(
		imagebitmap,
		width, height,
		trainData, trainContext,
		extract, dataset) {
		const testContext = this.testContext;
		const canvasContext = this.canvasContext;
		let edgeFilters;
		let layer2Filters;
		if (extract === undefined) {
			edgeFilters = new Filters(dataset + '-17');
			await edgeFilters.init();
			layer2Filters = new Filters(dataset + '-68')
			await layer2Filters.init();
		} else {
			edgeFilters = this._filters[0];
			layer2Filters = this._filters[1];
		}
		return new Promise(async function (resolve, reject) {
			testContext.clearRect(0, 0, width, height);
			testContext.drawImage(imagebitmap, 0, 0);
			testContext.save();
			const imagedata = testContext.getImageData(0, 0, width, height);
			testContext.clearRect(0, 0, width, height);
			const inputSettings = new LayerSettings(
				Math.round(edgeFilters.filters[0].width),
				4,
				[width, height],
				edgeFilters
			)
			let tData;
			if (trainContext) {
				const Tcontext = trainContext.getContext('2d');
				Tcontext.clearRect(0, 0, width, height);	
				Tcontext.drawImage(trainData, 0, 0);
				tData = {
					'canvas': Tcontext,
					'data': Tcontext.getImageData(0, 0, width, height)
				}
				drawSilhouette(Tcontext, width, height, tData.data);
			} else {
				tData = undefined;
			}
			const inputLayer = new Conv2D(
				imagedata.data,
				[],
				tData,
				inputSettings
			)
			inputLayer.canvas = testContext;
			const coords = await inputLayer.run();
			const listcoords1 = [];
			for (const coor of coords['coords']) {
				listcoords1.push(coor.filter);
			}
			// if (extract) {
			// 	await sendTrainigResults(extract, inputLayer.learnedFeatures, edgeFilters.dataset);
			// } else {
			// 	await sendTrainigResults(extract, listcoords1, edgeFilters.dataset);
			// }
			const layer2Settings = new LayerSettings(
				Math.round(layer2Filters.filters[0].width),
				4,
				[width, height],
				layer2Filters
			);
			layer2Settings.set('input', coords);
			layer2Settings.set('draw', true);
			const secondLayer = new Conv2D(
				imagedata.data,
				[],
				tData,
				layer2Settings
			);
			secondLayer.canvas = testContext;

			const secondCoords = await secondLayer.run();
			console.log(secondCoords);
			const listcoords = [];
			for (const coor of secondCoords['coords']) {
				listcoords.push(coor.filter);
			}
			// console.log(listcoords);
			// console.log(secondLayer.learnedFeatures);
			if (extract) {
				await sendTrainigResults(extract, secondLayer.learnedFeatures, layer2Filters.dataset);
			} else {
				await sendTrainigResults(extract, listcoords, layer2Filters.dataset);
			}
			// self.postMessage({'response': 'success'});
			rendering = false;
			resolve(true);
		});
	}
}

