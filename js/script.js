window.onload = function () {
	function toArray (list) {
		return Array.prototype.slice.call(list || []);
	}

	function cancel (ev) {
		ev.preventDefault();
	}

	function on (obj, event, callback) {
		obj.addEventListener(event, callback, false);
	}

	function getAsEntry (item) {
		if (item.getAsEntry) {
			return item.getAsEntry();
		} else if (item.webkitGetAsEntry) {
			return item.webkitGetAsEntry();
		} else {
			throw new Error('Not supported "getAsEntry".');
		}
	}

	function scan (rootDir) {
		var files = [],
			containerXml = {name: 'container.xml', buffer: null, level: 0},
			META_INF = {name: 'META-INF', dir: [containerXml]},
			processing = 0;

		files.push({name: 'mimetype', str: 'application/epub+zip', level: 0});
		files.push(META_INF);

		rootDir.getFile('META-INF/container.xml', {}, function (fileEntry) {
			readFile(fileEntry, function (result) {
				containerXml.buffer = result;
			});
		});

		function scanDir (dirEntry, dir) {
			var dirReader, entries = [];

			processing++;
			dirReader = dirEntry.createReader();

			(function readEntries () {
				dirReader.readEntries(function (results) {
					if (!results.length) {
						entries.forEach(function (entry) {
							if (entry.isDirectory) {
								var childDir = [];
								dir.push({name: entry.name, dir: childDir});
								scanDir(entry, childDir);
							} else {
								scanFile(entry, dir);
							}
						});
						processing--;
					} else {
						entries = entries.concat(toArray(results));
						readEntries();
					}
				});
			})();
		}

		function scanFile (fileEntry, dir) {
			var name = fileEntry.name;
			if (name === 'mimetype' || name === 'container.xml') return;
			readFile(fileEntry, function (result) {
				dir.push({name: fileEntry.name, buffer: result});
			});
		}

		function readFile (fileEntry, callback) {
			processing++;
			fileEntry.file(function (file) {
				var reader = new FileReader();
				reader.onloadend = function (ev) {
					callback(reader.result);
					processing--;
				};
				reader.readAsArrayBuffer(file);
			});
		}

		scanDir(rootDir, files);

		setTimeout(function wait() {
			if (processing > 0) {
				setTimeout(wait, 10);
			} else {
				build(files, rootDir.name);
			}
		}, 10);
	}

	function build (files, folderName) {
		jz.zip.pack({
			files: files,
			complete: function (buffer) {
				var blob = new Blob([buffer]),
					url = (window.URL || window.webkitURL).createObjectURL(blob),
					a = document.createElement('a'),
					e = document.createEvent('MouseEvent');
				a.download = folderName + '.epub';
				a.href = url;
				e.initEvent('click', true, true, window, 1, 0, 0, 0, 0, false, false, false, false, 0, null);
				a.dispatchEvent(e);
			}
		});
	}

	on(window, 'dragover', cancel);
	on(window, 'dragenter', cancel);
	on(window, 'drop', function (ev) {
		cancel(ev);
		scan(getAsEntry(ev.dataTransfer.items[0]));
	});
};