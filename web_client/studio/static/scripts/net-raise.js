/**
 * Net Raise layers modeling
 */

/**
 * Filters - Initializes a filters list with it's corresponding data info
 */
class Filters {
	/**
	 * constructor - stablish the dataset string in the object
	 * @param {String} dataset the filter's identification name
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
	 */
	set canvas (context) {
		this._ctx = context
	}
	/**
	 * setWeight - sets a weight new value
	 * @param {*} index position in weigths
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
		let successRate = '99.6';
		const activationMaps = Array(this.settings.filters.filters.length).fill([])
		const output = {
			'test': this.settings.filters.filters[0].name
		};
		output['coords'] = [];
		for (let y = 0; y < height; y += Math.round(stride)) {
			for (let x = 0; x < wid; x += Math.round(stride)) {
				const res = this.processWindow(x, y, successRate);
				for (let pos = 0; pos < activationMaps.length; i++) {
					activationMaps[pos].push(...res.map[pos])
				}
			}
		}
		return activationMaps;
	}
	/**
	 * processWindow - apply the convolutional operation
	 * to a segment of the input
	 * @param {*} x initial position
	 * @param {*} y initial position
	 * @param {*} rate
	 */
	processWindow(x, y, rate) {
		let activationMaps = Array(this.settings.filters.filters.length)
		activationMaps.fill(Array(3).fill(0))
		const [wid, height] = this.settings.get('inputSettings');
		for (let yPoint = y; yPoint < y + this.settings.filterWidth; yPoint++) {
			for (let xPoint = x; xPoint < x + this.settings.filterWidth; xPoint++) {
				try {
					// Extract a vector for the input pixel
					const pos = (wid * yPoint) + xPoint;
					const vector = [
						this.input[(pos * 4)],
						this.input[(pos * 4) + 1],
						this.input[(pos * 4) + 2],
						this.input[(pos * 4) + 3],
					]
					for (let i = 0; i < this.settings.filters.filters.length ; i++) {
						const filter = this.settings.filters.filters[i];
						const fPos = Math.round((imgFrame.length - 1));
						activationMaps[i][0] += filter.data[fPos] * vector[0];
						activationMaps[i][1] += filter.data[fPos + 1] * vector[1];
						activationMaps[i][2] += filter.data[fPos + 2] * vector[2];
						// activationMaps[i][0] += filter.data[fPos + 3] * vector[3];
					}
				} catch (err) {
					console.log(err);
					break;
				}
			}
		}
		for (let i = 0; i < activationMaps.length; i++) {
			let factor = this.settings.filterWidth ** 2;
			for (let chan = 0; chan < 3; i++) {
				activationMaps[i][chan] = activationMaps[i][chan] / factor;
			}
		}
		return {
				'color': 'red',
				'map': activationMaps,
				'value': 1
			}
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
		this._filters.push(new filters(dataset + '-17'));
		await this._filters[0].init();
		this._filters.push(new filters(dataset + '-68'));
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
			edgeFilters = new filters(dataset + '-17');
			await edgeFilters.init();
			layer2Filters = new filters(dataset + '-68')
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
			const inputLayer = new ConvolutionalLayer(
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
			const secondLayer = new ConvolutionalLayer(
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
			self.postMessage({'response': 'success'});
			rendering = false;
			resolve(true);
		});
	}
}
