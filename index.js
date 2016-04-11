"use strict";
var fs = require('fs');
var os = require('os');
var path = require('path');
var ts = require('typescript');
var FILENAME_TS = 'file.ts';
var FILENAME_TSX = 'file.tsx';
function tss(code, options) {
    if (options) {
        return new tss.TypeScriptSimple(options).compile(code);
    }
    else {
        return defaultTss.compile(code);
    }
}
var tss;
(function (tss) {
    var TypeScriptSimple = (function () {
        /**
         * @param {ts.CompilerOptions=} options TypeScript compile options (some options are ignored)
         * @param {boolean=} doSemanticChecks Throw if TypeScript semantic error found (default: true)
         * @param {Array<string>=} files Array of TypeScript files to load (default: [])
         * @constructor
         */
        function TypeScriptSimple(options, doSemanticChecks, files) {
            var _this = this;
            if (options === void 0) { options = {}; }
            if (doSemanticChecks === void 0) { doSemanticChecks = true; }
            if (files === void 0) { files = []; }
            this.doSemanticChecks = doSemanticChecks;
            this.service = null;
            this.outputs = {};
            this.files = {};
            // accept null
            options = options || {};
            if (options.target == null) {
                options.target = ts.ScriptTarget.ES5;
            }
            if (options.module == null) {
                options.module = ts.ModuleKind.None;
            }
            this.options = options;
            files.forEach(function (f) {
                var code = fs.readFileSync(f, 'utf8');
                _this.files[f] = { version: 0, text: code };
            });
        }
        /**
         * @param {string} code TypeScript source code to compile
         * @param {string=} fileName Only needed if you plan to use sourceMaps.
         *    Provide the complete filePath relevant to you
         * @return {string} The JavaScript with inline sourceMaps if sourceMaps were enabled
         * @throw {Error} A syntactic error or a semantic error (if doSemanticChecks is true)
         */
        TypeScriptSimple.prototype.compile = function (code, fileName) {
            if (!fileName) {
                if (this.options.jsx === ts.JsxEmit.Preserve) {
                    fileName = FILENAME_TSX;
                }
                else if (this.options.jsx === ts.JsxEmit.React) {
                    fileName = FILENAME_TSX;
                }
                else {
                    fileName = FILENAME_TS;
                }
            }
            if (!this.service) {
                this.service = this.createService();
            }
            var file = this.files[fileName];
            if (file) {
                file.text = code;
                file.version++;
            }
            else {
                this.files[fileName] = { version: 0, text: code };
            }
            return this.toJavaScript(this.service, fileName);
        };
        TypeScriptSimple.prototype.createService = function () {
            var _this = this;
            var defaultLib = this.getDefaultLibFileName(this.options);
            var defaultLibPath = path.join(this.getTypeScriptBinDir(), defaultLib);
            this.files[defaultLib] = { version: 0, text: fs.readFileSync(defaultLibPath).toString() };
            var serviceHost = {
                getScriptFileNames: function () { return [_this.getDefaultLibFileName(_this.options)].concat(Object.keys(_this.files)); },
                getScriptVersion: function (fileName) { return _this.files[fileName] && _this.files[fileName].version.toString(); },
                getScriptSnapshot: function (fileName) {
                    if (!_this.files[fileName]) {
                        if (fs.existsSync(fileName)) {
                            var code = fs.readFileSync(fileName, 'utf8');
                            _this.files[fileName] = { version: 0, text: code };
                        }
                    }
                    var file = _this.files[fileName];
                    if (file) {
                        return {
                            getText: function (start, end) { return file.text.substring(start, end); },
                            getLength: function () { return file.text.length; },
                            getLineStartPositions: function () { return []; },
                            getChangeRange: function (oldSnapshot) { return undefined; }
                        };
                    }
                    else {
                        return {
                            getText: function (start, end) { return ''; },
                            getLength: function () { return 0; },
                            getLineStartPositions: function () { return []; },
                            getChangeRange: function (oldSnapshot) { return undefined; }
                        };
                    }
                },
                getCurrentDirectory: function () { return process.cwd(); },
                getCompilationSettings: function () { return _this.options; },
                getDefaultLibFileName: function (options) {
                    return _this.getDefaultLibFileName(options);
                },
                // TODO: Use options.newLine
                getNewLine: function () { return os.EOL; },
                log: function (message) { return console.log(message); },
                trace: function (message) { return console.debug(message); },
                error: function (message) { return console.error(message); }
            };
            return ts.createLanguageService(serviceHost, ts.createDocumentRegistry());
        };
        TypeScriptSimple.prototype.getTypeScriptBinDir = function () {
            return path.dirname(require.resolve('typescript'));
        };
        TypeScriptSimple.prototype.getDefaultLibFileName = function (options) {
            if (options.target === ts.ScriptTarget.ES6) {
                return 'lib.es6.d.ts';
            }
            else {
                return 'lib.d.ts';
            }
        };
        /**
         * converts {"version":3,"file":"file.js","sourceRoot":"","sources":["file.ts"],"names":[],
         *    "mappings":"AAAA,IAAI,CAAC,GAAG,MAAM,CAAC"}
         * to {"version":3,"sources":["foo/test.ts"],"names":[],
         *    "mappings":"AAAA,IAAI,CAAC,GAAG,MAAM,CAAC","file":"foo/test.ts","sourcesContent":["var x = 'test';"]}
         * derived from : https://github.com/thlorenz/convert-source-map
         * @internal
         */
        TypeScriptSimple.prototype.getInlineSourceMap = function (mapText, fileName) {
            var sourceMap = JSON.parse(mapText);
            sourceMap.file = fileName;
            sourceMap.sources = [fileName];
            sourceMap.sourcesContent = [this.files[fileName].text];
            delete sourceMap.sourceRoot;
            return JSON.stringify(sourceMap);
        };
        TypeScriptSimple.prototype.toJavaScript = function (service, fileName) {
            var output = service.getEmitOutput(fileName);
            var allDiagnostics = service.getCompilerOptionsDiagnostics()
                .concat(service.getSyntacticDiagnostics(fileName));
            if (this.doSemanticChecks) {
                allDiagnostics = allDiagnostics.concat(service.getSemanticDiagnostics(fileName));
            }
            if (allDiagnostics.length) {
                throw new Error(this.formatDiagnostics(allDiagnostics));
            }
            var outDir = 'outDir' in this.options ? this.options.outDir : '.';
            var fileNameWithoutRoot = 'rootDir' in this.options ? fileName.replace(new RegExp('^' + this.options.rootDir), '') : fileName;
            var outputFileName;
            if (this.options.jsx === ts.JsxEmit.Preserve) {
                outputFileName = path.join(outDir, fileNameWithoutRoot.replace(/\.tsx$/, '.jsx'));
            }
            else {
                outputFileName = path.join(outDir, fileNameWithoutRoot.replace(/\.tsx?$/, '.js'));
            }
            // for Windows #37
            outputFileName = this.normalizeSlashes(outputFileName);
            var file = output.outputFiles.filter(function (file) { return file.name === outputFileName; })[0];
            var text = file.text;
            // If we have sourceMaps convert them to inline sourceMaps
            if (this.options.sourceMap) {
                var sourceMapFileName_1 = outputFileName + '.map';
                var sourceMapFile = output.outputFiles.filter(function (file) { return file.name === sourceMapFileName_1; })[0];
                // Transform sourcemap
                var sourceMapText = sourceMapFile.text;
                sourceMapText = this.getInlineSourceMap(sourceMapText, fileName);
                var base64SourceMapText = new Buffer(sourceMapText).toString('base64');
                var sourceMapComment = '//# sourceMappingURL=data:application/json;base64,' + base64SourceMapText;
                text = text.replace('//# sourceMappingURL=' + path.basename(sourceMapFileName_1), sourceMapComment);
            }
            return text;
        };
        TypeScriptSimple.prototype.normalizeSlashes = function (path) {
            return path.replace(/\\/g, "/");
        };
        TypeScriptSimple.prototype.formatDiagnostics = function (diagnostics) {
            return diagnostics.map(function (d) {
                if (d.file) {
                    return 'L' + d.file.getLineAndCharacterOfPosition(d.start).line + ': ' + d.messageText;
                }
                else {
                    return d.messageText;
                }
            }).join(os.EOL);
        };
        return TypeScriptSimple;
    }());
    tss.TypeScriptSimple = TypeScriptSimple;
})(tss || (tss = {}));
var defaultTss = new tss.TypeScriptSimple();
module.exports = tss;
