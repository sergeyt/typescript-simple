import ts = require('typescript');
declare function tss(code: string, options?: ts.CompilerOptions): string;
declare namespace tss {
    class TypeScriptSimple {
        private doSemanticChecks;
        private service;
        private outputs;
        private options;
        private files;
        /**
         * @param {ts.CompilerOptions=} options TypeScript compile options (some options are ignored)
         * @param {boolean=} doSemanticChecks Throw if TypeScript semantic error found (default: true)
         * @param {Array<string>=} files Array of TypeScript files to load (default: [])
         * @constructor
         */
        constructor(options?: ts.CompilerOptions, doSemanticChecks?: boolean, files?: Array<string>);
        /**
         * @param {string} code TypeScript source code to compile
         * @param {string=} fileName Only needed if you plan to use sourceMaps.
         *    Provide the complete filePath relevant to you
         * @return {string} The JavaScript with inline sourceMaps if sourceMaps were enabled
         * @throw {Error} A syntactic error or a semantic error (if doSemanticChecks is true)
         */
        compile(code: string, fileName?: string): string;
        private createService();
        private getTypeScriptBinDir();
        private getDefaultLibFileName(options);
        private toJavaScript(service, fileName);
        private normalizeSlashes(path);
        private formatDiagnostics(diagnostics);
    }
}
export = tss;
