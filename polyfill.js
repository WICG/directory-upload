/**********************************
 Directory Upload Proposal Polyfill
 Author: Ali Alabbas (Microsoft)
 **********************************/
(function() {
	// Do not proceed with the polyfill if Directory interface is already natively available,
	// or if webkitdirectory is not supported (i.e. not Chrome, since the polyfill only works in Chrome)
	if (window.Directory || !('webkitdirectory' in document.createElement('input'))) {
		return;
	}

	var directoryAttr = 'directories',
		dirPropFileInput = 'directory',
		dirPropDataTransfer = dirPropFileInput;

	var separator = '/';

	var Directory = function() {
		this.name = '';
		this.path = separator;
		this._children = {};
		this._items = false;
	};

	Directory.prototype.listContents = function() {
		var that = this;

		// from drag and drop
		if (this._items) {
			var getItem = function(entry) {
				if (entry.isDirectory) {
					var dir = new Directory();
					dir.name = entry.name;
					dir.path = entry.fullPath;
					dir._items = entry;

					return dir;
				} else {
					return new Promise(function(resolve, reject) {
						entry.file(function(file) {
							resolve(file);
						}, reject);
					});
				}
			};

			if (this.path === separator) {
				var promises = [];
				
				for (var i = 0; i < this._items.length; i++) {
					var entry = this._items[i].webkitGetAsEntry();
					
					promises.push(getItem(entry));
				}

				return Promise.all(promises);
			} else {
				return new Promise(function(resolve, reject) {
					that._items.createReader().readEntries(function(entries) {
						var promises = [];

						for (var i = 0; i < entries.length; i++) {
							var entry = entries[i];

							promises.push(getItem(entry));
						}
						
						resolve(Promise.all(promises));
					}, reject);
				});
			}
		// from file input
		} else {
			var arr = [];

			for (var child in this._children) {
				arr.push(this._children[child]);
			}

			return Promise.resolve(arr);
		}
	};

	// set blank directory as default for all inputs
	HTMLInputElement.prototype[dirPropFileInput] = new Directory();

	// expose Directory interface to window
	window.Directory = Directory;

	/********************
	 **** File Input ****
	 ********************/
	var convertInputs = function(nodes) {
		var recurse = function(dir, path, fullPath, file) {
			var pathPieces = path.split(separator);
			var dirName = pathPieces.shift();

			if (pathPieces.length > 0) {
				var subDir = new Directory();
				subDir.name = dirName;
				subDir.path = separator + fullPath;

				if (!dir._children[subDir.name]) {
					dir._children[subDir.name] = subDir;
				}

				recurse(dir._children[subDir.name], pathPieces.join(separator), fullPath, file);
			} else {
				dir._children[file.name] = file;
			}
		};

		for (var i = 0; i < nodes.length; i++) {
			var node = nodes[i];

			if (node.tagName === 'INPUT' && node.type === 'file' && node.hasAttribute(directoryAttr)) {
				node.setAttribute('webkitdirectory', '');

				node.addEventListener('change', function() {
					this[dirPropFileInput] = new Directory();

					var files = this.files;

					for (var j = 0; j < files.length; j++) {
						var file = files[j];
						var path = file.webkitRelativePath;
						var fullPath = path.substring(0, path.lastIndexOf(separator));

						recurse(this[dirPropFileInput], path, fullPath, file);
					}
				});
			}
		}
	};

	// polyfill file inputs when the DOM loads
	document.addEventListener('DOMContentLoaded', function(event) {
		convertInputs(document.getElementsByTagName('input'));
	});

	// polyfill file inputs that are created dynamically and inserted into the body
	var observer = new MutationObserver(function(mutations, observer) {
		for (var i = 0; i < mutations.length; i++) {
			if (mutations[i].addedNodes.length > 0) {
				convertInputs(mutations[i].addedNodes);
			}
		}
	});

	observer.observe(document.body, {childList: true, subtree: true});

	/***********************
	 **** Drag and drop ****
	 ***********************/
	// keep a reference to the original method
	var _addEventListener = Element.prototype.addEventListener;

	Element.prototype.addEventListener = function(type, listener, useCapture) {
		if (type === 'drop') {
			var _listener = listener;

			listener = function(e) {
				var dir = new Directory();
				dir._items = e.dataTransfer.items;

				e.dataTransfer[dirPropDataTransfer] = dir;

				_listener(e);
			};
		}

		// call the original method
		return _addEventListener.apply(this, arguments);
	};
}());