import { r as __exportAll } from "../_runtime.mjs";
//#region node_modules/onnxruntime-common/dist/esm/backend-impl.js
var backends = /* @__PURE__ */ new Map();
var backendsSortedByPriority = [];
var backendInitQueues = /* @__PURE__ */ new WeakMap();
/**
* Register a backend.
*
* @param name - the name as a key to lookup as an execution provider.
* @param backend - the backend object.
* @param priority - an integer indicating the priority of the backend. Higher number means higher priority. if priority
* < 0, it will be considered as a 'beta' version and will not be used as a fallback backend by default.
*
* @ignore
*/
var registerBackend = (name, backend, priority) => {
	if (backend && typeof backend.init === "function" && typeof backend.createInferenceSessionHandler === "function") {
		const currentBackend = backends.get(name);
		if (currentBackend === void 0) backends.set(name, {
			backend,
			priority
		});
		else if (currentBackend.priority > priority) return;
		else if (currentBackend.priority === priority) {
			if (currentBackend.backend !== backend) throw new Error(`cannot register backend "${name}" using priority ${priority}`);
		}
		if (priority >= 0) {
			const i = backendsSortedByPriority.indexOf(name);
			if (i !== -1) backendsSortedByPriority.splice(i, 1);
			for (let i = 0; i < backendsSortedByPriority.length; i++) if (backends.get(backendsSortedByPriority[i]).priority <= priority) {
				backendsSortedByPriority.splice(i, 0, name);
				return;
			}
			backendsSortedByPriority.push(name);
		}
		return;
	}
	throw new TypeError("not a valid backend");
};
/**
* Try to resolve and initialize a backend.
*
* @param backendName - the name of the backend.
* @returns the backend instance if resolved and initialized successfully, or an error message if failed.
*/
var tryResolveAndInitializeBackend = async (backendName) => {
	const backendInfo = backends.get(backendName);
	if (!backendInfo) return "backend not found.";
	if (backendInfo.initialized) return backendInfo.backend;
	else if (backendInfo.aborted) return backendInfo.error;
	else {
		const isInitializing = !!backendInfo.initPromise;
		try {
			if (!isInitializing) {
				const backend = backendInfo.backend;
				const previousInit = backendInitQueues.get(backend);
				backendInfo.initPromise = previousInit ? previousInit.then(async () => backend.init(backendName), async () => backend.init(backendName)) : backend.init(backendName);
				backendInitQueues.set(backend, backendInfo.initPromise);
			}
			await backendInfo.initPromise;
			backendInfo.initialized = true;
			return backendInfo.backend;
		} catch (e) {
			if (!isInitializing) {
				backendInfo.error = `${e}`;
				backendInfo.aborted = true;
			}
			return backendInfo.error;
		} finally {
			delete backendInfo.initPromise;
		}
	}
};
/**
* Resolve execution providers from the specific session options.
*
* @param options - the session options object.
* @returns a promise that resolves to a tuple of an initialized backend instance and a session options object with
* filtered EP list.
*
* @ignore
*/
var resolveBackendAndExecutionProviders = async (options) => {
	const eps = options.executionProviders || [];
	const backendHints = eps.map((i) => typeof i === "string" ? i : i.name);
	const backendNames = backendHints.length === 0 ? backendsSortedByPriority : backendHints;
	let backend;
	const errors = [];
	const availableBackendNames = /* @__PURE__ */ new Set();
	for (const backendName of backendNames) {
		const resolveResult = await tryResolveAndInitializeBackend(backendName);
		if (typeof resolveResult === "string") errors.push({
			name: backendName,
			err: resolveResult
		});
		else {
			if (!backend) backend = resolveResult;
			if (backend === resolveResult) availableBackendNames.add(backendName);
		}
	}
	if (!backend) throw new Error(`no available backend found. ERR: ${errors.map((e) => `[${e.name}] ${e.err}`).join(", ")}`);
	for (const { name, err } of errors) if (backendHints.includes(name)) console.warn(`removing requested execution provider "${name}" from session options because it is not available: ${err}`);
	const filteredEps = eps.filter((i) => availableBackendNames.has(typeof i === "string" ? i : i.name));
	return [backend, new Proxy(options, { get: (target, prop) => {
		if (prop === "executionProviders") return filteredEps;
		return Reflect.get(target, prop);
	} })];
};
/**
* Resolve the backend to create LoRA adapters with.
*
* Backends are tried in priority order. The first backend that supports LoRA adapters and initializes successfully is
* returned. Other backends are not initialized.
*
* @returns a promise that resolves to an initialized backend instance that supports LoRA adapters.
*
* @ignore
*/
var resolveBackendForLoraAdapter = async () => {
	const errors = [];
	for (const backendName of backendsSortedByPriority) {
		if (typeof backends.get(backendName).backend.createLoraAdapterHandler !== "function") continue;
		const resolveResult = await tryResolveAndInitializeBackend(backendName);
		if (typeof resolveResult !== "string") return resolveResult;
		errors.push({
			name: backendName,
			err: resolveResult
		});
	}
	const details = errors.length === 0 ? "" : ` ERR: ${errors.map((e) => `[${e.name}] ${e.err}`).join(", ")}`;
	throw new Error(`no available backend supports LoRA adapters.${details}`);
};
//#endregion
//#region node_modules/onnxruntime-common/dist/esm/version.js
var version = "1.31.1";
//#endregion
//#region node_modules/onnxruntime-common/dist/esm/env-impl.js
var logLevelValue = "warning";
var env$1 = {
	wasm: {},
	webgl: {},
	webgpu: {},
	versions: { common: version },
	set logLevel(value) {
		if (value === void 0) return;
		if (typeof value !== "string" || [
			"verbose",
			"info",
			"warning",
			"error",
			"fatal"
		].indexOf(value) === -1) throw new Error(`Unsupported logging level: ${value}`);
		logLevelValue = value;
	},
	get logLevel() {
		return logLevelValue;
	}
};
Object.defineProperty(env$1, "logLevel", { enumerable: true });
//#endregion
//#region node_modules/onnxruntime-common/dist/esm/env.js
/**
* Represent a set of flags as a global singleton.
*/
var env = env$1;
//#endregion
//#region node_modules/onnxruntime-common/dist/esm/trace.js
/**
* @ignore
*/
var TRACE = (deviceType, label) => {
	if (typeof env$1.trace === "undefined" ? !env$1.wasm.trace : !env$1.trace) return;
	console.timeStamp(`${deviceType}::ORT::${label}`);
};
var TRACE_FUNC = (msg, extraMsg) => {
	const stack = (/* @__PURE__ */ new Error()).stack?.split(/\r\n|\r|\n/g) || [];
	let hasTraceFunc = false;
	for (let i = 0; i < stack.length; i++) {
		if (hasTraceFunc && !stack[i].includes("TRACE_FUNC")) {
			let label = `FUNC_${msg}::${stack[i].trim().split(" ")[1]}`;
			if (extraMsg) label += `::${extraMsg}`;
			TRACE("CPU", label);
			return;
		}
		if (stack[i].includes("TRACE_FUNC")) hasTraceFunc = true;
	}
};
/**
* @ignore
*/
var TRACE_FUNC_BEGIN = (extraMsg) => {
	if (typeof env$1.trace === "undefined" ? !env$1.wasm.trace : !env$1.trace) return;
	TRACE_FUNC("BEGIN", extraMsg);
};
/**
* @ignore
*/
var TRACE_FUNC_END = (extraMsg) => {
	if (typeof env$1.trace === "undefined" ? !env$1.wasm.trace : !env$1.trace) return;
	TRACE_FUNC("END", extraMsg);
};
/**
* @ignore
*/
var TRACE_EVENT_BEGIN = (extraMsg) => {
	if (typeof env$1.trace === "undefined" ? !env$1.wasm.trace : !env$1.trace) return;
	console.time(`ORT::${extraMsg}`);
};
/**
* @ignore
*/
var TRACE_EVENT_END = (extraMsg) => {
	if (typeof env$1.trace === "undefined" ? !env$1.wasm.trace : !env$1.trace) return;
	console.timeEnd(`ORT::${extraMsg}`);
};
//#endregion
//#region node_modules/onnxruntime-common/dist/esm/lora-adapter-impl.js
var LoraAdapter$1 = class LoraAdapter$1 {
	constructor(backend, handler) {
		this.backend = backend;
		this.handler = handler;
	}
	static async create(uriOrBuffer) {
		TRACE_FUNC_BEGIN();
		if (typeof uriOrBuffer !== "string" && !(uriOrBuffer instanceof Uint8Array)) throw new TypeError("Unexpected argument[0]: must be 'path' or 'buffer'.");
		const backend = await resolveBackendForLoraAdapter();
		const handler = await backend.createLoraAdapterHandler(uriOrBuffer);
		TRACE_FUNC_END();
		return new LoraAdapter$1(backend, handler);
	}
	async release() {
		return this.handler.dispose();
	}
};
//#endregion
//#region node_modules/onnxruntime-common/dist/esm/tensor-conversion-impl.js
/**
* implementation of Tensor.toDataURL()
*/
var tensorToDataURL = (tensor, options) => {
	const canvas = typeof document !== "undefined" ? document.createElement("canvas") : new OffscreenCanvas(1, 1);
	canvas.width = tensor.dims[3];
	canvas.height = tensor.dims[2];
	const pixels2DContext = canvas.getContext("2d");
	if (pixels2DContext != null) {
		let width;
		let height;
		if (options?.tensorLayout !== void 0 && options.tensorLayout === "NHWC") {
			width = tensor.dims[2];
			height = tensor.dims[3];
		} else {
			width = tensor.dims[3];
			height = tensor.dims[2];
		}
		const inputformat = options?.format !== void 0 ? options.format : "RGB";
		const norm = options?.norm;
		let normMean;
		let normBias;
		if (norm === void 0 || norm.mean === void 0) normMean = [
			255,
			255,
			255,
			255
		];
		else if (typeof norm.mean === "number") normMean = [
			norm.mean,
			norm.mean,
			norm.mean,
			norm.mean
		];
		else {
			normMean = [
				norm.mean[0],
				norm.mean[1],
				norm.mean[2],
				0
			];
			if (norm.mean[3] !== void 0) normMean[3] = norm.mean[3];
		}
		if (norm === void 0 || norm.bias === void 0) normBias = [
			0,
			0,
			0,
			0
		];
		else if (typeof norm.bias === "number") normBias = [
			norm.bias,
			norm.bias,
			norm.bias,
			norm.bias
		];
		else {
			normBias = [
				norm.bias[0],
				norm.bias[1],
				norm.bias[2],
				0
			];
			if (norm.bias[3] !== void 0) normBias[3] = norm.bias[3];
		}
		const stride = height * width;
		let rTensorPointer = 0, gTensorPointer = stride, bTensorPointer = stride * 2, aTensorPointer = -1;
		if (inputformat === "RGBA") {
			rTensorPointer = 0;
			gTensorPointer = stride;
			bTensorPointer = stride * 2;
			aTensorPointer = stride * 3;
		} else if (inputformat === "RGB") {
			rTensorPointer = 0;
			gTensorPointer = stride;
			bTensorPointer = stride * 2;
		} else if (inputformat === "RBG") {
			rTensorPointer = 0;
			bTensorPointer = stride;
			gTensorPointer = stride * 2;
		}
		for (let i = 0; i < height; i++) for (let j = 0; j < width; j++) {
			const R = (tensor.data[rTensorPointer++] - normBias[0]) * normMean[0];
			const G = (tensor.data[gTensorPointer++] - normBias[1]) * normMean[1];
			const B = (tensor.data[bTensorPointer++] - normBias[2]) * normMean[2];
			const A = aTensorPointer === -1 ? 255 : (tensor.data[aTensorPointer++] - normBias[3]) * normMean[3];
			pixels2DContext.fillStyle = "rgba(" + R + "," + G + "," + B + "," + A + ")";
			pixels2DContext.fillRect(j, i, 1, 1);
		}
		if ("toDataURL" in canvas) return canvas.toDataURL();
		else throw new Error("toDataURL is not supported");
	} else throw new Error("Can not access image data");
};
/**
* implementation of Tensor.toImageData()
*/
var tensorToImageData = (tensor, options) => {
	const pixels2DContext = typeof document !== "undefined" ? document.createElement("canvas").getContext("2d") : new OffscreenCanvas(1, 1).getContext("2d");
	let image;
	if (pixels2DContext != null) {
		let width;
		let height;
		let channels;
		if (options?.tensorLayout !== void 0 && options.tensorLayout === "NHWC") {
			width = tensor.dims[2];
			height = tensor.dims[1];
			channels = tensor.dims[3];
		} else {
			width = tensor.dims[3];
			height = tensor.dims[2];
			channels = tensor.dims[1];
		}
		const inputformat = options !== void 0 ? options.format !== void 0 ? options.format : "RGB" : "RGB";
		const norm = options?.norm;
		let normMean;
		let normBias;
		if (norm === void 0 || norm.mean === void 0) normMean = [
			255,
			255,
			255,
			255
		];
		else if (typeof norm.mean === "number") normMean = [
			norm.mean,
			norm.mean,
			norm.mean,
			norm.mean
		];
		else {
			normMean = [
				norm.mean[0],
				norm.mean[1],
				norm.mean[2],
				255
			];
			if (norm.mean[3] !== void 0) normMean[3] = norm.mean[3];
		}
		if (norm === void 0 || norm.bias === void 0) normBias = [
			0,
			0,
			0,
			0
		];
		else if (typeof norm.bias === "number") normBias = [
			norm.bias,
			norm.bias,
			norm.bias,
			norm.bias
		];
		else {
			normBias = [
				norm.bias[0],
				norm.bias[1],
				norm.bias[2],
				0
			];
			if (norm.bias[3] !== void 0) normBias[3] = norm.bias[3];
		}
		const stride = height * width;
		if (options !== void 0) {
			if (options.format !== void 0 && channels === 4 && options.format !== "RGBA" || channels === 3 && options.format !== "RGB" && options.format !== "BGR") throw new Error("Tensor format doesn't match input tensor dims");
		}
		const step = 4;
		let rImagePointer = 0, gImagePointer = 1, bImagePointer = 2, aImagePointer = 3;
		let rTensorPointer = 0, gTensorPointer = stride, bTensorPointer = stride * 2, aTensorPointer = -1;
		if (inputformat === "RGBA") {
			rTensorPointer = 0;
			gTensorPointer = stride;
			bTensorPointer = stride * 2;
			aTensorPointer = stride * 3;
		} else if (inputformat === "RGB") {
			rTensorPointer = 0;
			gTensorPointer = stride;
			bTensorPointer = stride * 2;
		} else if (inputformat === "RBG") {
			rTensorPointer = 0;
			bTensorPointer = stride;
			gTensorPointer = stride * 2;
		}
		image = pixels2DContext.createImageData(width, height);
		for (let i = 0; i < height * width; rImagePointer += step, gImagePointer += step, bImagePointer += step, aImagePointer += step, i++) {
			image.data[rImagePointer] = (tensor.data[rTensorPointer++] - normBias[0]) * normMean[0];
			image.data[gImagePointer] = (tensor.data[gTensorPointer++] - normBias[1]) * normMean[1];
			image.data[bImagePointer] = (tensor.data[bTensorPointer++] - normBias[2]) * normMean[2];
			image.data[aImagePointer] = aTensorPointer === -1 ? 255 : (tensor.data[aTensorPointer++] - normBias[3]) * normMean[3];
		}
	} else throw new Error("Can not access image data");
	return image;
};
//#endregion
//#region node_modules/onnxruntime-common/dist/esm/tensor-factory-impl.js
/**
* Create a new tensor object from image object
*
* @param buffer - Extracted image buffer data - assuming RGBA format
* @param imageFormat - input image configuration - required configurations height, width, format
* @param tensorFormat - output tensor configuration - Default is RGB format
*/
var bufferToTensor = (buffer, options) => {
	if (buffer === void 0) throw new Error("Image buffer must be defined");
	if (options.height === void 0 || options.width === void 0) throw new Error("Image height and width must be defined");
	if (options.tensorLayout === "NHWC") throw new Error("NHWC Tensor layout is not supported yet");
	const { height, width } = options;
	const norm = options.norm ?? {
		mean: 255,
		bias: 0
	};
	let normMean;
	let normBias;
	if (typeof norm.mean === "number") normMean = [
		norm.mean,
		norm.mean,
		norm.mean,
		norm.mean
	];
	else normMean = [
		norm.mean[0],
		norm.mean[1],
		norm.mean[2],
		norm.mean[3] ?? 255
	];
	if (typeof norm.bias === "number") normBias = [
		norm.bias,
		norm.bias,
		norm.bias,
		norm.bias
	];
	else normBias = [
		norm.bias[0],
		norm.bias[1],
		norm.bias[2],
		norm.bias[3] ?? 0
	];
	const inputformat = options.format !== void 0 ? options.format : "RGBA";
	const outputformat = options.tensorFormat !== void 0 ? options.tensorFormat !== void 0 ? options.tensorFormat : "RGB" : "RGB";
	const stride = height * width;
	const float32Data = outputformat === "RGBA" ? new Float32Array(stride * 4) : new Float32Array(stride * 3);
	let step = 4, rImagePointer = 0, gImagePointer = 1, bImagePointer = 2, aImagePointer = 3;
	let rTensorPointer = 0, gTensorPointer = stride, bTensorPointer = stride * 2, aTensorPointer = -1;
	if (inputformat === "RGB") {
		step = 3;
		rImagePointer = 0;
		gImagePointer = 1;
		bImagePointer = 2;
		aImagePointer = -1;
	}
	if (outputformat === "RGBA") aTensorPointer = stride * 3;
	else if (outputformat === "RBG") {
		rTensorPointer = 0;
		bTensorPointer = stride;
		gTensorPointer = stride * 2;
	} else if (outputformat === "BGR") {
		bTensorPointer = 0;
		gTensorPointer = stride;
		rTensorPointer = stride * 2;
	}
	for (let i = 0; i < stride; i++, rImagePointer += step, bImagePointer += step, gImagePointer += step, aImagePointer += step) {
		float32Data[rTensorPointer++] = (buffer[rImagePointer] + normBias[0]) / normMean[0];
		float32Data[gTensorPointer++] = (buffer[gImagePointer] + normBias[1]) / normMean[1];
		float32Data[bTensorPointer++] = (buffer[bImagePointer] + normBias[2]) / normMean[2];
		if (aTensorPointer !== -1 && aImagePointer !== -1) float32Data[aTensorPointer++] = (buffer[aImagePointer] + normBias[3]) / normMean[3];
	}
	return outputformat === "RGBA" ? new Tensor$1("float32", float32Data, [
		1,
		4,
		height,
		width
	]) : new Tensor$1("float32", float32Data, [
		1,
		3,
		height,
		width
	]);
};
/**
* implementation of Tensor.fromImage().
*/
var tensorFromImage = async (image, options) => {
	const isHTMLImageEle = typeof HTMLImageElement !== "undefined" && image instanceof HTMLImageElement;
	const isImageDataEle = typeof ImageData !== "undefined" && image instanceof ImageData;
	const isImageBitmap = typeof ImageBitmap !== "undefined" && image instanceof ImageBitmap;
	const isString = typeof image === "string";
	let data;
	let bufferToTensorOptions = options ?? {};
	const createCanvas = () => {
		if (typeof document !== "undefined") return document.createElement("canvas");
		else if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(1, 1);
		else throw new Error("Canvas is not supported");
	};
	const createCanvasContext = (canvas) => {
		if (typeof HTMLCanvasElement !== "undefined" && canvas instanceof HTMLCanvasElement) return canvas.getContext("2d");
		else if (canvas instanceof OffscreenCanvas) return canvas.getContext("2d");
		else return null;
	};
	if (isHTMLImageEle) {
		const canvas = createCanvas();
		canvas.width = image.width;
		canvas.height = image.height;
		const pixels2DContext = createCanvasContext(canvas);
		if (pixels2DContext != null) {
			let height = image.height;
			let width = image.width;
			if (options !== void 0 && options.resizedHeight !== void 0 && options.resizedWidth !== void 0) {
				height = options.resizedHeight;
				width = options.resizedWidth;
			}
			if (options !== void 0) {
				bufferToTensorOptions = options;
				if (options.tensorFormat !== void 0) throw new Error("Image input config format must be RGBA for HTMLImageElement");
				else bufferToTensorOptions.tensorFormat = "RGBA";
				bufferToTensorOptions.height = height;
				bufferToTensorOptions.width = width;
			} else {
				bufferToTensorOptions.tensorFormat = "RGBA";
				bufferToTensorOptions.height = height;
				bufferToTensorOptions.width = width;
			}
			pixels2DContext.drawImage(image, 0, 0);
			data = pixels2DContext.getImageData(0, 0, width, height).data;
		} else throw new Error("Can not access image data");
	} else if (isImageDataEle) {
		let height;
		let width;
		if (options !== void 0 && options.resizedWidth !== void 0 && options.resizedHeight !== void 0) {
			height = options.resizedHeight;
			width = options.resizedWidth;
		} else {
			height = image.height;
			width = image.width;
		}
		if (options !== void 0) bufferToTensorOptions = options;
		bufferToTensorOptions.format = "RGBA";
		bufferToTensorOptions.height = height;
		bufferToTensorOptions.width = width;
		if (options !== void 0) {
			const tempCanvas = createCanvas();
			tempCanvas.width = width;
			tempCanvas.height = height;
			const pixels2DContext = createCanvasContext(tempCanvas);
			if (pixels2DContext != null) {
				pixels2DContext.putImageData(image, 0, 0);
				data = pixels2DContext.getImageData(0, 0, width, height).data;
			} else throw new Error("Can not access image data");
		} else data = image.data;
	} else if (isImageBitmap) {
		if (options === void 0) throw new Error("Please provide image config with format for Imagebitmap");
		const canvas = createCanvas();
		canvas.width = image.width;
		canvas.height = image.height;
		const pixels2DContext = createCanvasContext(canvas);
		if (pixels2DContext != null) {
			const height = image.height;
			const width = image.width;
			pixels2DContext.drawImage(image, 0, 0, width, height);
			data = pixels2DContext.getImageData(0, 0, width, height).data;
			bufferToTensorOptions.height = height;
			bufferToTensorOptions.width = width;
			return bufferToTensor(data, bufferToTensorOptions);
		} else throw new Error("Can not access image data");
	} else if (isString) return new Promise((resolve, reject) => {
		const canvas = createCanvas();
		const context = createCanvasContext(canvas);
		if (!image || !context) return reject();
		const newImage = new Image();
		newImage.crossOrigin = "Anonymous";
		newImage.src = image;
		newImage.onload = () => {
			canvas.width = newImage.width;
			canvas.height = newImage.height;
			context.drawImage(newImage, 0, 0, canvas.width, canvas.height);
			const img = context.getImageData(0, 0, canvas.width, canvas.height);
			bufferToTensorOptions.height = canvas.height;
			bufferToTensorOptions.width = canvas.width;
			resolve(bufferToTensor(img.data, bufferToTensorOptions));
		};
	});
	else throw new Error("Input data provided is not supported - aborted tensor creation");
	if (data !== void 0) return bufferToTensor(data, bufferToTensorOptions);
	else throw new Error("Input data provided is not supported - aborted tensor creation");
};
/**
* implementation of Tensor.fromTexture().
*/
var tensorFromTexture = (texture, options) => {
	const { width, height, download, dispose } = options;
	return new Tensor$1({
		location: "texture",
		type: "float32",
		texture,
		dims: [
			1,
			height,
			width,
			4
		],
		download,
		dispose
	});
};
/**
* implementation of Tensor.fromGpuBuffer().
*/
var tensorFromGpuBuffer = (gpuBuffer, options) => {
	const { dataType, dims, download, dispose } = options;
	return new Tensor$1({
		location: "gpu-buffer",
		type: dataType ?? "float32",
		gpuBuffer,
		dims,
		download,
		dispose
	});
};
/**
* implementation of Tensor.fromMLTensor().
*/
var tensorFromMLTensor = (mlTensor, options) => {
	const { dataType, dims, download, dispose } = options;
	return new Tensor$1({
		location: "ml-tensor",
		type: dataType ?? "float32",
		mlTensor,
		dims,
		download,
		dispose
	});
};
/**
* implementation of Tensor.fromPinnedBuffer().
*/
var tensorFromPinnedBuffer = (type, buffer, dims) => new Tensor$1({
	location: "cpu-pinned",
	type,
	data: buffer,
	dims: dims ?? [buffer.length]
});
//#endregion
//#region node_modules/onnxruntime-common/dist/esm/tensor-impl-type-mapping.js
var NUMERIC_TENSOR_TYPE_TO_TYPEDARRAY_MAP = /* @__PURE__ */ new Map([
	["float32", Float32Array],
	["uint8", Uint8Array],
	["int8", Int8Array],
	["uint16", Uint16Array],
	["int16", Int16Array],
	["int32", Int32Array],
	["bool", Uint8Array],
	["float64", Float64Array],
	["uint32", Uint32Array],
	["int4", Uint8Array],
	["uint4", Uint8Array]
]);
var NUMERIC_TENSOR_TYPEDARRAY_TO_TYPE_MAP = /* @__PURE__ */ new Map([
	[Float32Array, "float32"],
	[Uint8Array, "uint8"],
	[Int8Array, "int8"],
	[Uint16Array, "uint16"],
	[Int16Array, "int16"],
	[Int32Array, "int32"],
	[Float64Array, "float64"],
	[Uint32Array, "uint32"]
]);
var isTypedArrayChecked = false;
var checkTypedArray = () => {
	if (!isTypedArrayChecked) {
		isTypedArrayChecked = true;
		const isBigInt64ArrayAvailable = typeof BigInt64Array !== "undefined" && BigInt64Array.from;
		const isBigUint64ArrayAvailable = typeof BigUint64Array !== "undefined" && BigUint64Array.from;
		const Float16Array = globalThis.Float16Array;
		const isFloat16ArrayAvailable = typeof Float16Array !== "undefined" && Float16Array.from;
		if (isBigInt64ArrayAvailable) {
			NUMERIC_TENSOR_TYPE_TO_TYPEDARRAY_MAP.set("int64", BigInt64Array);
			NUMERIC_TENSOR_TYPEDARRAY_TO_TYPE_MAP.set(BigInt64Array, "int64");
		}
		if (isBigUint64ArrayAvailable) {
			NUMERIC_TENSOR_TYPE_TO_TYPEDARRAY_MAP.set("uint64", BigUint64Array);
			NUMERIC_TENSOR_TYPEDARRAY_TO_TYPE_MAP.set(BigUint64Array, "uint64");
		}
		if (isFloat16ArrayAvailable) {
			NUMERIC_TENSOR_TYPE_TO_TYPEDARRAY_MAP.set("float16", Float16Array);
			NUMERIC_TENSOR_TYPEDARRAY_TO_TYPE_MAP.set(Float16Array, "float16");
		} else NUMERIC_TENSOR_TYPE_TO_TYPEDARRAY_MAP.set("float16", Uint16Array);
	}
};
//#endregion
//#region node_modules/onnxruntime-common/dist/esm/tensor-utils-impl.js
/**
* calculate size from dims.
*
* @param dims the dims array. May be an illegal input.
*/
var calculateSize = (dims) => {
	let size = 1;
	for (let i = 0; i < dims.length; i++) {
		const dim = dims[i];
		if (typeof dim !== "number" || !Number.isSafeInteger(dim)) throw new TypeError(`dims[${i}] must be an integer, got: ${dim}`);
		if (dim < 0) throw new RangeError(`dims[${i}] must be a non-negative integer, got: ${dim}`);
		size *= dim;
	}
	return size;
};
/**
* implementation of Tensor.reshape()
*/
var tensorReshape = (tensor, dims) => {
	switch (tensor.location) {
		case "cpu": return new Tensor$1(tensor.type, tensor.data, dims);
		case "cpu-pinned": return new Tensor$1({
			location: "cpu-pinned",
			data: tensor.data,
			type: tensor.type,
			dims
		});
		case "texture": return new Tensor$1({
			location: "texture",
			texture: tensor.texture,
			type: tensor.type,
			dims
		});
		case "gpu-buffer": return new Tensor$1({
			location: "gpu-buffer",
			gpuBuffer: tensor.gpuBuffer,
			type: tensor.type,
			dims
		});
		case "ml-tensor": return new Tensor$1({
			location: "ml-tensor",
			mlTensor: tensor.mlTensor,
			type: tensor.type,
			dims
		});
		default: throw new Error(`tensorReshape: tensor location ${tensor.location} is not supported`);
	}
};
//#endregion
//#region node_modules/onnxruntime-common/dist/esm/tensor-impl.js
/**
* the implementation of Tensor interface.
*
* @ignore
*/
var Tensor$1 = class {
	/**
	* implementation.
	*/
	constructor(arg0, arg1, arg2) {
		checkTypedArray();
		let type;
		let dims;
		if (typeof arg0 === "object" && "location" in arg0) {
			this.dataLocation = arg0.location;
			type = arg0.type;
			dims = arg0.dims;
			switch (arg0.location) {
				case "cpu-pinned": {
					const expectedTypedArrayConstructor = NUMERIC_TENSOR_TYPE_TO_TYPEDARRAY_MAP.get(type);
					if (!expectedTypedArrayConstructor) throw new TypeError(`unsupported type "${type}" to create tensor from pinned buffer`);
					if (!(arg0.data instanceof expectedTypedArrayConstructor)) throw new TypeError(`buffer should be of type ${expectedTypedArrayConstructor.name}`);
					this.cpuData = arg0.data;
					break;
				}
				case "texture":
					if (type !== "float32") throw new TypeError(`unsupported type "${type}" to create tensor from texture`);
					this.gpuTextureData = arg0.texture;
					this.downloader = arg0.download;
					this.disposer = arg0.dispose;
					break;
				case "gpu-buffer":
					if (type !== "float32" && type !== "float16" && type !== "int32" && type !== "int64" && type !== "uint32" && type !== "uint8" && type !== "bool" && type !== "uint4" && type !== "int4") throw new TypeError(`unsupported type "${type}" to create tensor from gpu buffer`);
					this.gpuBufferData = arg0.gpuBuffer;
					this.downloader = arg0.download;
					this.disposer = arg0.dispose;
					break;
				case "ml-tensor":
					if (type !== "float32" && type !== "float16" && type !== "int32" && type !== "int64" && type !== "uint32" && type !== "uint64" && type !== "int8" && type !== "uint8" && type !== "bool" && type !== "uint4" && type !== "int4") throw new TypeError(`unsupported type "${type}" to create tensor from MLTensor`);
					this.mlTensorData = arg0.mlTensor;
					this.downloader = arg0.download;
					this.disposer = arg0.dispose;
					break;
				default: throw new Error(`Tensor constructor: unsupported location '${this.dataLocation}'`);
			}
		} else {
			let data;
			let maybeDims;
			if (typeof arg0 === "string") {
				type = arg0;
				maybeDims = arg2;
				if (arg0 === "string") {
					if (!Array.isArray(arg1)) throw new TypeError("A string tensor's data must be a string array.");
					data = arg1;
				} else {
					const typedArrayConstructor = NUMERIC_TENSOR_TYPE_TO_TYPEDARRAY_MAP.get(arg0);
					if (typedArrayConstructor === void 0) throw new TypeError(`Unsupported tensor type: ${arg0}.`);
					if (Array.isArray(arg1)) {
						if (arg0 === "float16" && typedArrayConstructor === Uint16Array || arg0 === "uint4" || arg0 === "int4") throw new TypeError(`Creating a ${arg0} tensor from number array is not supported. Please use ${typedArrayConstructor.name} as data.`);
						else if (arg0 === "uint64" || arg0 === "int64") data = typedArrayConstructor.from(arg1, BigInt);
						else data = typedArrayConstructor.from(arg1);
					} else if (arg1 instanceof typedArrayConstructor) data = arg1;
					else if (arg1 instanceof Uint8ClampedArray) {
						if (arg0 === "uint8") data = Uint8Array.from(arg1);
						else throw new TypeError(`A Uint8ClampedArray tensor's data must be type of uint8`);
					} else if (arg0 === "float16" && arg1 instanceof Uint16Array && typedArrayConstructor !== Uint16Array) data = new globalThis.Float16Array(arg1.buffer, arg1.byteOffset, arg1.length);
					else throw new TypeError(`A ${type} tensor's data must be type of ${typedArrayConstructor}`);
				}
			} else {
				maybeDims = arg1;
				if (Array.isArray(arg0)) {
					if (arg0.length === 0) throw new TypeError("Tensor type cannot be inferred from an empty array.");
					const firstElementType = typeof arg0[0];
					if (firstElementType === "string") {
						type = "string";
						data = arg0;
					} else if (firstElementType === "boolean") {
						type = "bool";
						data = Uint8Array.from(arg0);
					} else throw new TypeError(`Invalid element type of data array: ${firstElementType}.`);
				} else if (arg0 instanceof Uint8ClampedArray) {
					type = "uint8";
					data = Uint8Array.from(arg0);
				} else {
					const mappedType = NUMERIC_TENSOR_TYPEDARRAY_TO_TYPE_MAP.get(arg0.constructor);
					if (mappedType === void 0) throw new TypeError(`Unsupported type for tensor data: ${arg0.constructor}.`);
					type = mappedType;
					data = arg0;
				}
			}
			if (maybeDims === void 0) maybeDims = [data.length];
			else if (!Array.isArray(maybeDims)) throw new TypeError("A tensor's dims must be a number array");
			dims = maybeDims;
			this.cpuData = data;
			this.dataLocation = "cpu";
		}
		const size = calculateSize(dims);
		if (this.cpuData && size !== this.cpuData.length) {
			if ((type === "uint4" || type === "int4") && Math.ceil(size / 2) === this.cpuData.length) {} else throw new Error(`Tensor's size(${size}) does not match data length(${this.cpuData.length}).`);
		}
		this.type = type;
		this.dims = dims;
		this.size = size;
	}
	static async fromImage(image, options) {
		return tensorFromImage(image, options);
	}
	static fromTexture(texture, options) {
		return tensorFromTexture(texture, options);
	}
	static fromGpuBuffer(gpuBuffer, options) {
		return tensorFromGpuBuffer(gpuBuffer, options);
	}
	static fromMLTensor(mlTensor, options) {
		return tensorFromMLTensor(mlTensor, options);
	}
	static fromPinnedBuffer(type, buffer, dims) {
		return tensorFromPinnedBuffer(type, buffer, dims);
	}
	toDataURL(options) {
		return tensorToDataURL(this, options);
	}
	toImageData(options) {
		return tensorToImageData(this, options);
	}
	get data() {
		this.ensureValid();
		if (!this.cpuData) throw new Error("The data is not on CPU. Use `getData()` to download GPU data to CPU, or use `texture` or `gpuBuffer` property to access the GPU data directly.");
		return this.cpuData;
	}
	get location() {
		return this.dataLocation;
	}
	get texture() {
		this.ensureValid();
		if (!this.gpuTextureData) throw new Error("The data is not stored as a WebGL texture.");
		return this.gpuTextureData;
	}
	get gpuBuffer() {
		this.ensureValid();
		if (!this.gpuBufferData) throw new Error("The data is not stored as a WebGPU buffer.");
		return this.gpuBufferData;
	}
	get mlTensor() {
		this.ensureValid();
		if (!this.mlTensorData) throw new Error("The data is not stored as a WebNN MLTensor.");
		return this.mlTensorData;
	}
	async getData(releaseData) {
		this.ensureValid();
		switch (this.dataLocation) {
			case "cpu":
			case "cpu-pinned": return this.data;
			case "texture":
			case "gpu-buffer":
			case "ml-tensor":
				if (!this.downloader) throw new Error("The current tensor is not created with a specified data downloader.");
				if (this.isDownloading) throw new Error("The current tensor is being downloaded.");
				try {
					this.isDownloading = true;
					const data = await this.downloader();
					this.downloader = void 0;
					this.dataLocation = "cpu";
					this.cpuData = data;
					if (releaseData && this.disposer) {
						this.disposer();
						this.disposer = void 0;
					}
					return data;
				} finally {
					this.isDownloading = false;
				}
			default: throw new Error(`cannot get data from location: ${this.dataLocation}`);
		}
	}
	dispose() {
		if (this.isDownloading) throw new Error("The current tensor is being downloaded.");
		if (this.disposer) {
			this.disposer();
			this.disposer = void 0;
		}
		this.cpuData = void 0;
		this.gpuTextureData = void 0;
		this.gpuBufferData = void 0;
		this.mlTensorData = void 0;
		this.downloader = void 0;
		this.isDownloading = void 0;
		this.dataLocation = "none";
	}
	ensureValid() {
		if (this.dataLocation === "none") throw new Error("The tensor is disposed.");
	}
	reshape(dims) {
		this.ensureValid();
		if (this.downloader || this.disposer) throw new Error("Cannot reshape a tensor that owns GPU resource.");
		return tensorReshape(this, dims);
	}
};
//#endregion
//#region node_modules/onnxruntime-common/dist/esm/tensor.js
var Tensor = Tensor$1;
//#endregion
//#region node_modules/onnxruntime-common/dist/esm/inference-session.js
var InferenceSession = class InferenceSession$1 {
	constructor(handler, backend) {
		this.handler = handler;
		this.backend = backend;
	}
	async run(feeds, arg1, arg2) {
		TRACE_FUNC_BEGIN();
		TRACE_EVENT_BEGIN("InferenceSession.run");
		const fetches = {};
		let options = {};
		if (typeof feeds !== "object" || feeds === null || feeds instanceof Tensor || Array.isArray(feeds)) throw new TypeError("'feeds' must be an object that use input names as keys and OnnxValue as corresponding values.");
		let isFetchesEmpty = true;
		if (typeof arg1 === "object") {
			if (arg1 === null) throw new TypeError("Unexpected argument[1]: cannot be null.");
			if (arg1 instanceof Tensor) throw new TypeError("'fetches' cannot be a Tensor");
			if (Array.isArray(arg1)) {
				if (arg1.length === 0) throw new TypeError("'fetches' cannot be an empty array.");
				isFetchesEmpty = false;
				for (const name of arg1) {
					if (typeof name !== "string") throw new TypeError("'fetches' must be a string array or an object.");
					if (this.outputNames.indexOf(name) === -1) throw new RangeError(`'fetches' contains invalid output name: ${name}.`);
					fetches[name] = null;
				}
				if (typeof arg2 === "object" && arg2 !== null) options = arg2;
				else if (typeof arg2 !== "undefined") throw new TypeError("'options' must be an object.");
			} else {
				let isFetches = false;
				const arg1Keys = Object.getOwnPropertyNames(arg1);
				for (const name of this.outputNames) if (arg1Keys.indexOf(name) !== -1) {
					const v = arg1[name];
					if (v === null || v instanceof Tensor) {
						isFetches = true;
						isFetchesEmpty = false;
						fetches[name] = v;
					}
				}
				if (isFetches) {
					if (typeof arg2 === "object" && arg2 !== null) options = arg2;
					else if (typeof arg2 !== "undefined") throw new TypeError("'options' must be an object.");
				} else options = arg1;
			}
		} else if (typeof arg1 !== "undefined") throw new TypeError("Unexpected argument[1]: must be 'fetches' or 'options'.");
		for (const name of this.inputNames) if (typeof feeds[name] === "undefined") throw new Error(`input '${name}' is missing in 'feeds'.`);
		if (isFetchesEmpty) for (const name of this.outputNames) fetches[name] = null;
		let activeLoraAdapters;
		if (options.activeLoraAdapters !== void 0) {
			if (!Array.isArray(options.activeLoraAdapters)) throw new TypeError("'activeLoraAdapters' must be an array.");
			activeLoraAdapters = options.activeLoraAdapters.map((adapter) => {
				if (!(adapter instanceof LoraAdapter$1)) throw new TypeError("'activeLoraAdapters' must be an array of LoraAdapter objects.");
				if (adapter.backend !== this.backend) throw new Error("LoRA adapter was created by a different backend than the session.");
				return adapter.handler;
			});
		}
		const results = await this.handler.run(feeds, fetches, options, activeLoraAdapters);
		const returnValue = {};
		for (const key in results) if (Object.hasOwnProperty.call(results, key)) {
			const result = results[key];
			if (result instanceof Tensor) returnValue[key] = result;
			else returnValue[key] = new Tensor(result.type, result.data, result.dims);
		}
		TRACE_EVENT_END("InferenceSession.run");
		TRACE_FUNC_END();
		return returnValue;
	}
	async release() {
		return this.handler.dispose();
	}
	static async create(arg0, arg1, arg2, arg3) {
		TRACE_FUNC_BEGIN();
		TRACE_EVENT_BEGIN("InferenceSession.create");
		let filePathOrUint8Array;
		let options = {};
		if (typeof arg0 === "string") {
			filePathOrUint8Array = arg0;
			if (typeof arg1 === "object" && arg1 !== null) options = arg1;
			else if (typeof arg1 !== "undefined") throw new TypeError("'options' must be an object.");
		} else if (arg0 instanceof Uint8Array) {
			filePathOrUint8Array = arg0;
			if (typeof arg1 === "object" && arg1 !== null) options = arg1;
			else if (typeof arg1 !== "undefined") throw new TypeError("'options' must be an object.");
		} else if (arg0 instanceof ArrayBuffer || typeof SharedArrayBuffer !== "undefined" && arg0 instanceof SharedArrayBuffer) {
			const buffer = arg0;
			let byteOffset = 0;
			let byteLength = arg0.byteLength;
			if (typeof arg1 === "object" && arg1 !== null) options = arg1;
			else if (typeof arg1 === "number") {
				byteOffset = arg1;
				if (!Number.isSafeInteger(byteOffset)) throw new RangeError("'byteOffset' must be an integer.");
				if (byteOffset < 0 || byteOffset >= buffer.byteLength) throw new RangeError(`'byteOffset' is out of range [0, ${buffer.byteLength}).`);
				byteLength = arg0.byteLength - byteOffset;
				if (typeof arg2 === "number") {
					byteLength = arg2;
					if (!Number.isSafeInteger(byteLength)) throw new RangeError("'byteLength' must be an integer.");
					if (byteLength <= 0 || byteOffset + byteLength > buffer.byteLength) throw new RangeError(`'byteLength' is out of range (0, ${buffer.byteLength - byteOffset}].`);
					if (typeof arg3 === "object" && arg3 !== null) options = arg3;
					else if (typeof arg3 !== "undefined") throw new TypeError("'options' must be an object.");
				} else if (typeof arg2 !== "undefined") throw new TypeError("'byteLength' must be a number.");
			} else if (typeof arg1 !== "undefined") throw new TypeError("'options' must be an object.");
			filePathOrUint8Array = new Uint8Array(buffer, byteOffset, byteLength);
		} else throw new TypeError("Unexpected argument[0]: must be 'path' or 'buffer'.");
		const [backend, optionsWithValidatedEPs] = await resolveBackendAndExecutionProviders(options);
		const handler = await backend.createInferenceSessionHandler(filePathOrUint8Array, optionsWithValidatedEPs);
		TRACE_EVENT_END("InferenceSession.create");
		TRACE_FUNC_END();
		return new InferenceSession$1(handler, backend);
	}
	startProfiling() {
		this.handler.startProfiling();
	}
	endProfiling() {
		this.handler.endProfiling();
	}
	get inputNames() {
		return this.handler.inputNames;
	}
	get outputNames() {
		return this.handler.outputNames;
	}
	get inputMetadata() {
		return this.handler.inputMetadata;
	}
	get outputMetadata() {
		return this.handler.outputMetadata;
	}
};
//#endregion
//#region node_modules/onnxruntime-common/dist/esm/lora-adapter.js
var LoraAdapter = LoraAdapter$1;
//#endregion
//#region node_modules/onnxruntime-common/dist/esm/index.js
var esm_exports = /* @__PURE__ */ __exportAll({
	InferenceSession: () => InferenceSession,
	LoraAdapter: () => LoraAdapter,
	TRACE: () => TRACE,
	TRACE_EVENT_BEGIN: () => TRACE_EVENT_BEGIN,
	TRACE_EVENT_END: () => TRACE_EVENT_END,
	TRACE_FUNC_BEGIN: () => TRACE_FUNC_BEGIN,
	TRACE_FUNC_END: () => TRACE_FUNC_END,
	Tensor: () => Tensor,
	env: () => env,
	registerBackend: () => registerBackend
});
//#endregion
export { TRACE as a, TRACE_FUNC_BEGIN as c, registerBackend as d, Tensor as i, TRACE_FUNC_END as l, LoraAdapter as n, TRACE_EVENT_BEGIN as o, InferenceSession as r, TRACE_EVENT_END as s, esm_exports as t, env as u };
