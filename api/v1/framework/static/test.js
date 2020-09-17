class Editor {
	constructor(backgrounds) {
		console.log('Initializing new Editor Object');
		console.log(backgrounds);
		this._backgrounds = backgrounds;
	}
	thumbnails() {
		// Return list of video frames
		console.log(this._backgrounds);
	}
	async appendTo(root) {
		this._cont = document.createElement('div');
		this._cont.setAttribute('cont', 'segmentation_tool');
		const link = document.createElement('link');
		link.rel = 'stylesheet';
		link.type = 'text/css';
		link.ref = 'http://localhost:6089/tool/front-end/tool.css';
		document.getElementsByTagName('HEAD')[0];
		const contentReq = await fetch('http://localhost:6089/tool/front-end/tool.html');
		const content = await contentReq.text();
		this._cont.innerHTML = content;
		root.appendChild(this._cont);
	}
}