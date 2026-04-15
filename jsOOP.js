/* jshint esversion:11 */

(async function (Scratch) {
    "use strict";

    if (!Scratch.extensions || !Scratch.extensions.unsandboxed) {
        throw new Error("'JS OOP' extension must run unsandboxed!");
    }

    const vm = Scratch.vm;

    const DEBUG = true;

    const isNode =
        typeof process !== "undefined" &&
        !!process.versions &&
        !!process.versions.node; // This could be simpler but this is the most "official" way to check

    if (!vm.jwArray) vm.extensionManager.loadExtensionIdSync("jwArray");
    const jwArray = vm.jwArray;

    // Wait a few seconds before trying to load dogeiscutObject to give the project a chance to load it first
    let dogeiscutObjectLoaded = !!vm.dogeiscutObject;
    if (!vm.dogeiscutObject) {
        setTimeout(() => {
            if (!vm.dogeiscutObject) {
                vm.extensionManager
                    .loadExtensionURL(
                        "https://extensions.penguinmod.com/extensions/DogeisCut/dogeiscutObject.js",
                    )
                    .then(() => {
                        dogeiscutObjectLoaded = true;
                        if (DEBUG)
                            console.log("dogeiscutObject loaded successfully");
                    })
                    .catch((error) => {
                        console.error("Failed to load dogeiscutObject:", error);
                        // Continue even if loading fails
                        dogeiscutObjectLoaded = false;
                    });
            } else {
                dogeiscutObjectLoaded = true;
            }
        }, 3000); // Wait 3 seconds
    }

    let isScratchBlocksReady = typeof ScratchBlocks === "object";
    const codeEditorHandlers = new Map();
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

    // Store for function hat blocks
    const functionHats = new Map();

    function initBlockTools() {
        window.addEventListener("message", (e) => {
            if (e.data?.type === "code-change") {
                const handler = codeEditorHandlers.get(e.data.id);
                if (handler) handler(e.data.value);
            }
        });

        const recyclableDiv = document.createElement("div");
        recyclableDiv.setAttribute(
            "style",
            `display: flex; justify-content: center; padding-top: 10px; width: 250px; height: 200px;`,
        );

        const fakeDiv = document.createElement("div");
        fakeDiv.setAttribute(
            "style",
            "background: #272822; border-radius: 10px; border: none; width: 100%; height: calc(100% - 20px);",
        );
        recyclableDiv.appendChild(fakeDiv);

        ScratchBlocks.FieldCustom.registerInput(
            "jsoop-codeEditor",
            recyclableDiv,
            (field) => {
                const inputObject = field.inputSource;
                const input = inputObject.firstChild;
                const srcBlock = field.sourceBlock_;
                const parent = srcBlock.parentBlock_;
                const dragCheck =
                    parent.isInFlyout ||
                    srcBlock.svgGroup_.classList.contains("blocklyDragging")
                        ? "none"
                        : "all";

                inputObject.setAttribute("pointer-events", "none");
                input.style.height = "210px";
                const iframe = document.createElement("iframe");
                iframe.setAttribute(
                    "style",
                    `pointer-events: ${dragCheck}; background: #272822; border-radius: 10px; border: none; ${isSafari ? "" : "width: 100%;"} height: calc(100% - 20px);`,
                );
                iframe.setAttribute("sandbox", "allow-scripts");

                const html = `
        <!DOCTYPE html>
        <html><head>
        <style>html, body, #editor {background: #272822; margin: 0; padding: 0; height: 100%; width: 100%;}</style>
        </head>
        <body>
        <div id="editor"></div>
        <script src="https://cdn.jsdelivr.net/npm/ace-builds@1.32.3/src-min-noconflict/ace.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/ace-builds@1.32.3/src-min-noconflict/mode-javascript.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/ace-builds@1.32.3/src-min-noconflict/theme-monokai.js"></script>
        <script>
        window.addEventListener("message", function(e) {
          const editor = ace.edit("editor");
          editor.setOptions({
            fontSize: "15px", showPrintMargin: false,
            highlightActiveLine: true, useWorker: false
          });

          editor.session.setMode("ace/mode/javascript");
          editor.setTheme("ace/theme/monokai");
          editor.setValue(e.data.value);
          editor.session.on("change", () => parent.postMessage({
            type: "code-change", id: "${srcBlock.id}", value: editor.getValue()
          }, "*"));
        }, { once: true });
        </script>
        </body>
        </html>`;
                iframe.src = URL.createObjectURL(
                    new Blob([html], {
                        type: "text/html",
                    }),
                );
                input.replaceChild(iframe, input.firstChild);
                iframe.onload = () => {
                    let value = field.getValue();
                    if (value === "jsoop-init-xyz789@!") {
                        const outerType = srcBlock.parentBlock_.type;
                        if (outerType.endsWith("evalJS"))
                            value = `return {name: "Alice"}`;
                        else if (outerType.endsWith("runJS"))
                            value = `console.log("Hello!")`;
                        field.setValue(value);
                    }

                    iframe.contentWindow.postMessage(
                        {
                            value,
                        },
                        "*",
                    );
                };

                codeEditorHandlers.set(srcBlock.id, (value) =>
                    field.setValue(value),
                );

                const resizeHandle = document.createElement("div");
                resizeHandle.setAttribute(
                    "style",
                    `pointer-events: ${dragCheck}; position: absolute; right: 5px; bottom: 15px; width: 12px; height: 12px; background: #ffffff40; cursor: se-resize; border-radius: 0px 0 50px 0;`,
                );
                input.appendChild(resizeHandle);

                let isResizing = false;
                let startX, startY, startW, startH;
                resizeHandle.addEventListener("mousedown", (e) => {
                    if (parent.isInFlyout) return;
                    e.preventDefault();
                    isResizing = true;
                    startX = e.clientX;
                    startY = e.clientY;
                    startW = input.offsetWidth;
                    startH = input.offsetHeight;
                    ScratchBlocks.mainWorkspace.allowDragging = false;
                    parent.setMovable(false);

                    function onMouseMove(ev) {
                        if (!isResizing) return;
                        iframe.style.pointerEvents = "none";
                        const newW = Math.max(
                            150,
                            startW + (ev.clientX - startX),
                        );
                        const newH = Math.max(
                            100,
                            startH + (ev.clientY - startY),
                        );
                        input.style.width = `${newW}px`;
                        input.style.height = `${newH}px`;
                        resizeHandle.style.left = `${newW - 20}px`;
                        resizeHandle.style.top = `${newH - 40}px`;
                        inputObject.setAttribute("width", newW);
                        inputObject.setAttribute("height", newH);
                        field.size_.width = newW;
                        field.size_.height = newH - 10;
                        if (srcBlock?.render) srcBlock.render();
                    }

                    function onMouseUp() {
                        isResizing = false;
                        ScratchBlocks.mainWorkspace.allowDragging = true;
                        parent.setMovable(true);
                        document.removeEventListener("mousemove", onMouseMove);
                        document.removeEventListener("mouseup", onMouseUp);
                    }

                    document.addEventListener("mousemove", onMouseMove);
                    document.addEventListener("mouseup", onMouseUp);
                });

                const ogSetAtt = parent.svgGroup_.setAttribute;
                parent.svgGroup_.setAttribute = (...args) => {
                    if (args[0] === "class") {
                        if (
                            parent.isInFlyout ||
                            args[1].includes("blocklyDragging")
                        ) {
                            iframe.style.pointerEvents = "none";
                            resizeHandle.style.pointerEvents = "none";
                        } else {
                            iframe.style.pointerEvents = "all";
                            resizeHandle.style.pointerEvents = "all";
                        }
                    }
                    ogSetAtt.call(parent.svgGroup_, ...args);
                };
            },
            () => {},
            () => {},
        );
    }
    if (isScratchBlocksReady) initBlockTools();

    function safeSerialize(obj) {
        const seen = new WeakSet();
        return JSON.stringify(
            obj,
            function (key, value) {
                if (typeof value === "bigint") {
                    const minSafe = BigInt(Number.MIN_SAFE_INTEGER);
                    const maxSafe = BigInt(Number.MAX_SAFE_INTEGER);
                    if (value >= minSafe && value <= maxSafe) {
                        return Number(value);
                    } else {
                        return value.toString();
                    }
                }

                if (value && typeof value === "object") {
                    if (seen.has(value)) return "[Circular]";
                    seen.add(value);
                }
                return value;
            },
            2,
        );
    }

    class JSObject {
        get customId() {
            return "jsObject";
        }

        constructor(value) {
            this.value = value;
        }

        toJSON() {
            try {
                const v = this.value;
                const t = typeof v;

                if (v === null) return null;
                if (t === "number" || t === "boolean" || t === "string")
                    return v;
                if (t === "undefined") return undefined;
                if (t === "bigint") {
                    const minSafe = BigInt(Number.MIN_SAFE_INTEGER);
                    const maxSafe = BigInt(Number.MAX_SAFE_INTEGER);
                    if (v >= minSafe && v <= maxSafe) {
                        return Number(v);
                    } else {
                        return v.toString();
                    }
                }

                if (t === "function") return v.toString();

                try {
                    const s = safeSerialize(v);
                    try {
                        if (DEBUG) console.dir(s);
                        return JSON.parse(s);
                    } catch (_) {
                        return s;
                    }
                } catch (e) {
                    return String(v);
                }
            } catch (e) {
                return String(this.value);
            }
        }

        toString() {
            try {
                const v = this.value;
                if (v === null) return "null";
                if (v === undefined) return "undefined";
                const t = typeof v;
                if (t === "function") {
                    return v.name ? `[Function ${v.name}]` : "[Function]";
                }
                if (t === "object") {
                    try {
                        if (DEBUG)
                            console.dir({
                                safe: safeSerialize(v),
                            });

                        if (Array.isArray(v)) return `[Array(${v.length})]`;
                        if (v && v.constructor && v.constructor.name)
                            return `[${v.constructor.name}]`;
                        return "[Object]";
                    } catch (e) {
                        return v && v.constructor && v.constructor.name
                            ? `[object ${v.constructor.name}]`
                            : "[object]";
                    }
                }

                if (t === "string") return v;
                return String(v);
            } catch (e) {
                return "[unprintable]";
            }
        }

        toReporterContent() {
            const pre = document.createElement("pre");
            pre.style.whiteSpace = "pre-wrap";
            pre.style.margin = "0";
            pre.style.fontFamily = "monospace";
            pre.textContent = this.toString();
            return pre;
        }

        toMonitorContent() {
            return this.toReporterContent();
        }

        toListItem() {
            return this.toReporterContent();
        }

        toListEditor() {
            return this.toString();
        }

        fromListEditor(edit) {
            try {
                this.value = JSON.parse(edit);
            } catch {
                this.value = edit;
            }
            return this;
        }

        static toType(x) {
            if (x instanceof JSObject) return x;

            // Check if it's a lookup table marker from another extension
            if (
                x &&
                typeof x === "object" &&
                x._jsoopLookupMarker &&
                x.lookupId
            ) {
                const ext = vm.runtime.ext_jsoop;
                if (ext) {
                    const actualObject = ext._getFromLookupTable(x.lookupId);
                    if (actualObject) {
                        return actualObject;
                    }
                }
            }

            if (
                x &&
                typeof x === "object" &&
                x.customId &&
                typeof x.customId === "string"
            ) {
                try {
                    if (
                        vm &&
                        vm.runtime &&
                        vm.runtime.serializers &&
                        vm.runtime.serializers[x.customId]
                    ) {
                        return new JSObject(x);
                    }
                } catch (_) {}
                return new JSObject(x);
            }

            return new JSObject(x);
        }

        static prepareForSerialize(v) {
            // Check if this should be stored in the lookup table
            const ext = vm.runtime.ext_jsoop;
            if (ext && ext._shouldUseLookupTable(v)) {
                const marker = ext._storeInLookupTable(new JSObject(v));
                return {
                    _jsoopLookupMarker: true,
                    lookupId: marker.lookupId,
                };
            }

            if (
                v &&
                typeof v === "object" &&
                v.customId &&
                vm &&
                vm.runtime &&
                vm.runtime.serializers &&
                vm.runtime.serializers[v.customId]
            ) {
                try {
                    return {
                        _nestedCustom: true,
                        typeId: v.customId,
                        data: vm.runtime.serializers[v.customId].serialize(v),
                    };
                } catch (e) {}
            }

            if (typeof v === "function") {
                return {
                    _functionSource: v.toString(),
                };
            }

            try {
                const json = safeSerialize(v);
                return {
                    _json: json,
                };
            } catch (e) {
                return {
                    _string: String(v),
                };
            }
        }

        static reconstructFromSerialize(obj) {
            try {
                if (obj && typeof obj === "object") {
                    // Handle lookup table markers during deserialization
                    if (obj._jsoopLookupMarker && obj.lookupId) {
                        const ext = vm.runtime.ext_jsoop;
                        if (ext) {
                            const actualObject = ext._getFromLookupTable(
                                obj.lookupId,
                            );
                            if (actualObject) {
                                return actualObject;
                            }
                        }
                        // If we can't find it in lookup table (shouldn't happen for runtime objects),
                        // return a placeholder
                        return new JSObject({
                            _jsoopLookupMissing: true,
                            originalLookupId: obj.lookupId,
                        });
                    }

                    if (
                        obj._nestedCustom &&
                        obj.typeId &&
                        vm.runtime.serializers[obj.typeId]
                    ) {
                        return vm.runtime.serializers[obj.typeId].deserialize(
                            obj.data,
                        );
                    }
                    if (
                        obj._functionSource &&
                        typeof obj._functionSource === "string"
                    ) {
                        try {
                            const fn = eval("(" + obj._functionSource + ")");
                            return fn;
                        } catch (e) {
                            try {
                                return eval(obj._functionSource);
                            } catch (ee) {
                                return obj._functionSource;
                            }
                        }
                    }
                    if (obj._json) {
                        try {
                            return JSON.parse(obj._json);
                        } catch (e) {
                            return obj._json;
                        }
                    }
                    if (obj._string) {
                        return obj._string;
                    }
                }
            } catch (e) {}
            return null;
        }
    }

    const JSObjectDescriptor = {
        Type: JSObject,
        Block: {
            blockType: Scratch.BlockType.REPORTER,
            blockShape: Scratch.BlockShape.BUMPED,
            forceOutputType: "JSObject",
            disableMonitor: true,
        },
        Argument: {
            shape: Scratch.BlockShape.BUMPED,
            exemptFromNormalization: true,
            check: ["JSObject"],
        },
    };

    if (isNode) {
        //(() => { if ("undefined" == typeof Scratch || !Scratch.vm) throw new Error("Scratch.vm not found"); const e = Scratch.vm; if ("undefined" == typeof require) throw new Error("require is not available (needs unsandboxed environment)"); const t = require("fs"), r = require("path"), i = require("os"); function o() { if (e._pmSavePatched) return; e._pmSavePatched = !0; const t = ["_saveProjectZip", "saveProjectSb3", "saveProjectZip", "_packProject"]; let r = null, i = null; for (const o of t) if ("function" == typeof e[o]) { r = o, i = e[o]; break } i || ("undefined" != typeof JSZip ? (r = "_saveProjectZip", i = function() { return new JSZip }, e._saveProjectZip = i) : (r = "_saveProjectZip", i = function() { return null }, e._saveProjectZip = i)), e._pmOriginalSave || (e._pmOriginalSave = i); e[r] = function(...t) { const r = i.apply(this, t); try { const t = e._pmInjectedFiles || []; if (r && "function" == typeof r.file) { for (const e of t) { const t = String(e.path || "").replace(/^\/+/, ""); r.file(t, e.data, { binary: !!e.binary }) } try { e._projectZip = r } catch (e) { } return r } if (r && "function" == typeof r.then) return r.then((r => { try { if (r && "function" == typeof r.file) { for (const e of t) { const t = String(e.path || "").replace(/^\/+/, ""); r.file(t, e.data, { binary: !!e.binary }) } try { e._projectZip = r } catch (e) { } } else { e._pmProjectExtraFiles = e._pmProjectExtraFiles || []; for (const r of t) e._pmProjectExtraFiles.push({ name: r.path, data: r.data, binary: !!r.binary }) } } catch (e) { console.error("inject (async) failed", e) } })).catch((() => { })), r; if (r instanceof ArrayBuffer || r instanceof Uint8Array) { e._pmProjectExtraFiles = e._pmProjectExtraFiles || []; for (const r of t) e._pmProjectExtraFiles.push({ name: r.path, data: r.data, binary: !!r.binary }); return r } e._pmProjectExtraFiles = e._pmProjectExtraFiles || []; for (const r of t) e._pmProjectExtraFiles.push({ name: r.path, data: r.data, binary: !!r.binary }); return r } catch (e) { return console.error("save wrapper error", e), r } }, console.log("SB3 helpers: patched vm." + r) } e._pmInjectedFiles = e._pmInjectedFiles || [], e._pmOriginalSave = e._pmOriginalSave || null, global.injectHiddenFile = (t, r) => { const i = String(t || "hidden.txt"), n = r; return e._pmInjectedFiles = e._pmInjectedFiles || [], e._pmInjectedFiles.push({ path: "extras/" + i.replace(/^\/+/, ""), data: n, binary: !1 }), o(), !0 }, global.addFolderToProjectZip = async function(i, n = "node_modules") { if (o(), !(i = String(i || ""))) throw new Error("no dir"); const a = r.resolve(i); return await async function i(o) { const c = await t.promises.readdir(o, { withFileTypes: !0 }); for (const s of c) { const c = r.join(o, s.name), p = r.relative(a, c), l = r.posix.join(n, p.split(r.sep).join("/")); if (s.isDirectory()) await i(c); else if (s.isFile()) { const r = await t.promises.readFile(c); if (e._pmInjectedFiles.push({ path: l, data: r, binary: !0 }), e._projectZip && "function" == typeof e._projectZip.file) try { e._projectZip.file(l, r, { binary: !0 }) } catch (e) { console.error(e) } } } }(a), !0 }, global.extractFolderFromProjectZip = async function(n) { if (o(), !n) throw new Error("no folder"); const a = await (async () => { if (e._projectZip) return e._projectZip; const t = e._pmOriginalSave || e._saveProjectZip; try { const r = t.apply(e, []); return r && "function" == typeof r.then ? await r : r } catch (t) { return console.error("failed to get project zip", t), e._projectZip || null } })(); if (!a) throw new Error("no zip available (vm._projectZip missing and calling save failed)"); const c = r.join(i.tmpdir(), function() { const e = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"; let t = ""; for (let r = 0; r < 12; r++)t += e[Math.floor(Math.random() * e.length)]; return `sb3-${t}-${Date.now()}` }()); await t.promises.mkdir(c, { recursive: !0 }); const s = n.replace(/^\/+|\/+$/g, ""), p = Object.keys(a.files || {}); for (const e of p) { if (!e.startsWith(s + "/")) continue; const i = a.files[e], o = e.slice(s.length + 1), n = r.join(c, o); if (i.dir) await t.promises.mkdir(n, { recursive: !0 }); else { let i; await t.promises.mkdir(r.dirname(n), { recursive: !0 }); try { i = await a.files[e].async("nodebuffer") } catch (t) { if (!a.files[e]._data || !a.files[e]._data.compressedContent) throw t; { const t = a.files[e]._data.compressedContent, r = new Uint8Array(Object.keys(t).map((e => t[e]))); i = Buffer.from(r) } } await t.promises.writeFile(n, i) } } return c }, global.moveFolderFromProjectZipToTmpdir = async function(t) { o(); const r = await global.extractFolderFromProjectZip(t), i = e._projectZip || e._pmOriginalSave && ("function" == typeof e._pmOriginalSave ? e._projectZip : null); if (i && i.files) { const e = t.replace(/^\/+|\/+$/g, ""), r = Object.keys(i.files).filter((t => t.startsWith(e + "/"))); for (const e of r) try { "function" == typeof i.remove ? i.remove(e) : delete i.files[e] } catch (t) { console.warn("could not remove", e, t) } } else e._pmProjectExtraFiles = e._pmProjectExtraFiles || [], e._pmProjectExtraFiles = e._pmProjectExtraFiles.filter((e => !e.name.startsWith(t + "/"))); return r }, o() })();
    }

    class JSOOPExtension {
        constructor() {
            this.JSObject = JSObject;
            // Internal-only lookup table - users have NO access to this
            this._jsObjectLookup = new Map();
            this._nextLookupId = 1;
            this._lookupTableEnabled = true;
            this._classArgDefaults = new Map();

            // Store built-in objects that should always be in lookup table
            this._builtInObjects = new Map();

            vm.runtime.registerCompiledExtensionBlocks(
                "jsoop",
                this.getCompileInfo(),
            );

            if (
                vm &&
                vm.runtime &&
                typeof vm.runtime.registerSerializer === "function"
            ) {
                vm.runtime.registerSerializer(
                    "jsObject",
                    (v) => {
                        if (v instanceof JSObject) {
                            try {
                                const inner = v.value;

                                return {
                                    wrapped:
                                        JSObject.prepareForSerialize(inner),
                                };
                            } catch (e) {
                                return {
                                    wrapped: {
                                        _string: String(v.value),
                                    },
                                };
                            }
                        }
                        return null;
                    },
                    (data) => {
                        try {
                            if (!data || typeof data !== "object") return null;
                            const reconstructed =
                                JSObject.reconstructFromSerialize(data.wrapped);
                            return new JSObject(reconstructed);
                        } catch (_) {
                            return null;
                        }
                    },
                );
            }

            if (vm && vm.runtime && typeof vm.runtime.on === "function") {
                vm.runtime.on("workspaceUpdate", () => {
                    codeEditorHandlers.clear();
                    if (!isScratchBlocksReady) {
                        isScratchBlocksReady =
                            typeof ScratchBlocks === "object";
                        if (isScratchBlocksReady) initBlockTools();
                    }
                });
            }

            // Store reference for static methods to access
            this.runtime = Scratch.vm.runtime;

            // Pre-populate built-in objects in lookup table
            this._initializeBuiltInObjects();
        }

        // Initialize built-in objects that should always be in lookup table
        _initializeBuiltInObjects() {
            const builtIns = [
                Math,
                Object,
                Array,
                String,
                Number,
                Boolean,
                Function,
                Date,
                RegExp,
                JSON,
                Promise,
                Error,
                Map,
                Set,
                WeakMap,
                WeakSet,
                Symbol,
                Proxy,
                Reflect,
                Intl,
                console,
                globalThis,
            ];

            builtIns.forEach((builtIn) => {
                const jsObject = new JSObject(builtIn);
                const lookupId = this._generateLookupId();
                this._builtInObjects.set(builtIn, lookupId);
                this._jsObjectLookup.set(lookupId, jsObject);
            });
        }

        // Internal method to generate unique lookup IDs
        _generateLookupId() {
            return `jsoop_${this._nextLookupId++}_${Date.now()}`;
        }

        // Internal method to store JSObject in lookup table and return marker
        _storeInLookupTable(jsObject) {
            if (!this._lookupTableEnabled) return jsObject;

            // Check if this is a built-in object that's already in the lookup table
            const builtInLookupId = this._builtInObjects.get(jsObject.value);
            if (builtInLookupId) {
                return {
                    _jsoopLookupMarker: true,
                    lookupId: builtInLookupId,
                    toString: () =>
                        new JSObject().toString.apply({
                            value: this._convertToNativeValue(
                                this._getFromLookupTable(builtInLookupId),
                            ),
                        }),
                    toJSON: () => ({
                        _jsoopLookupMarker: true,
                        lookupId: builtInLookupId,
                    }),
                };
            }

            const lookupId = this._generateLookupId();
            this._jsObjectLookup.set(lookupId, jsObject);

            if (DEBUG)
                console.log(
                    "Stored JSObject in lookup table:",
                    lookupId,
                    jsObject,
                );

            // Return a marker object that other extensions can store
            return {
                _jsoopLookupMarker: true,
                lookupId: lookupId,
                toString: () =>
                    new JSObject().toString.apply({
                        value: this._convertToNativeValue(
                            this._getFromLookupTable(lookupId),
                        ),
                    }),
                toJSON: () => ({
                    _jsoopLookupMarker: true,
                    lookupId: lookupId,
                }),
            };
        }

        // Store a class-arg default value in the lookup table and return the lookup ID.
        _storeClassArgDefault(defaultValue) {
            const marker = this._storeInLookupTable(new JSObject(defaultValue));
            if (marker && marker.lookupId) {
                this._classArgDefaults.set(marker.lookupId, defaultValue);
                return marker;
            }
            return null;
        }

        // Internal method to retrieve a stored class arg default by lookup ID.
        _getClassArgDefault(lookupId) {
            if (this._classArgDefaults.has(lookupId)) {
                return this._classArgDefaults.get(lookupId);
            }
            const obj = this._getFromLookupTable(lookupId);
            if (obj instanceof JSObject) return obj.value;
            return obj;
        }

        // Internal method to retrieve JSObject from lookup table
        _getFromLookupTable(lookupId) {
            if (!this._lookupTableEnabled) return null;

            const obj = this._jsObjectLookup.get(lookupId);
            if (DEBUG && obj)
                console.log(
                    "Retrieved JSObject from lookup table:",
                    lookupId,
                    obj,
                );
            return obj;
        }

        // Internal method to determine if an object should use lookup table
        _shouldUseLookupTable(value) {
            if (!this._lookupTableEnabled) return false;
            if (value === null || value === undefined) return false;

            const type = typeof value;

            // Always use lookup table for functions
            if (type === "function") return true;

            // Check if it's a built-in object
            if (this._isBuiltInObject(value)) return true;

            // For objects, check if they're problematic for serialization
            if (type === "object") {
                // DOM elements
                if (value instanceof HTMLElement) return true;
                if (value instanceof Node) return true;

                // Built-in objects that don't serialize well
                if (value instanceof Map) return true;
                if (value instanceof Set) return true;
                if (value instanceof WeakMap) return true;
                if (value instanceof WeakSet) return true;
                if (value instanceof Promise) return true;
                if (value instanceof Error) return true;

                // Objects with circular references
                try {
                    JSON.stringify(value);
                } catch (e) {
                    return true; // Can't serialize, use lookup table
                }

                // Large objects might be better in lookup table
                if (Object.keys(value).length > 100) return true;

                // Objects with methods/properties that can't be serialized
                if (this._hasUnserializableProperties(value)) return true;
            }

            return false;
        }

        // Check if an object is a built-in JavaScript object
        _isBuiltInObject(value) {
            if (value === null || value === undefined) return false;

            // Check against known built-in objects
            const builtIns = [
                Math,
                Object,
                Array,
                String,
                Number,
                Boolean,
                Function,
                Date,
                RegExp,
                JSON,
                Promise,
                Error,
                Map,
                Set,
                WeakMap,
                WeakSet,
                Symbol,
                Proxy,
                Reflect,
                Intl,
                console,
                globalThis,
            ];

            return builtIns.includes(value);
        }

        // Check if an object has properties that can't be properly serialized
        _hasUnserializableProperties(obj) {
            try {
                const props = Object.getOwnPropertyNames(obj);
                for (const prop of props) {
                    try {
                        const value = obj[prop];
                        if (typeof value === "function") return true;
                        if (value && typeof value === "object") {
                            JSON.stringify(value);
                        }
                    } catch (e) {
                        return true;
                    }
                }
            } catch (e) {
                return true;
            }
            return false;
        }

        // Internal method to automatically handle JSObjects for other extensions
        _wrapForOtherExtensions(jsObject) {
            if (!this._lookupTableEnabled) return jsObject;

            if (jsObject instanceof JSObject) {
                const innerValue = jsObject.value;
                if (this._shouldUseLookupTable(innerValue)) {
                    return this._storeInLookupTable(jsObject);
                }
            }

            return jsObject;
        }

        // NEW: Ensure we always resolve JSObject references before using them
        _resolveJSObject(obj) {
            if (obj instanceof JSObject) {
                return obj.value;
            }

            // Handle lookup table markers
            if (
                obj &&
                typeof obj === "object" &&
                obj._jsoopLookupMarker &&
                obj.lookupId
            ) {
                const actualObject = this._getFromLookupTable(obj.lookupId);
                if (actualObject instanceof JSObject) {
                    return actualObject.value;
                }
            }

            return obj;
        }

        // NEW: Get the actual value from any JSObject or marker
        _getActualValue(value) {
            if (value instanceof JSObject) {
                return value.value;
            }

            // Handle lookup table markers
            if (
                value &&
                typeof value === "object" &&
                value._jsoopLookupMarker &&
                value.lookupId
            ) {
                const actualObject = this._getFromLookupTable(value.lookupId);
                if (actualObject instanceof JSObject) {
                    return actualObject.value;
                }
            }

            return value;
        }

        // Resolve an instance argument for write operations.
        // Returns an object { holder, value } where `holder` is the JSObject
        // wrapper (if present) that should be updated when creating a new object,
        // and `value` is the underlying value to operate on.
        _resolveInstanceHolder(arg) {
            if (arg instanceof JSObject)
                return { holder: arg, value: arg.value };
            if (
                arg &&
                typeof arg === "object" &&
                arg._jsoopLookupMarker &&
                arg.lookupId
            ) {
                const actual = this._getFromLookupTable(arg.lookupId);
                if (actual instanceof JSObject)
                    return { holder: actual, value: actual.value };
                return { holder: null, value: actual };
            }
            return { holder: null, value: arg };
        }

        // NEW: Error handling wrapper that always forwards to console.error
        _handleError(error, context) {
            console.error(`JS OOP Error in ${context}:`, error);
            return error;
        }

        // NEW: Safe execution wrapper that catches and forwards all errors
        _safeExecute(fn, context, ...args) {
            try {
                return fn.apply(this, args);
            } catch (error) {
                throw this._handleError(error, context);
            }
        }

        // NEW: Safe async execution wrapper
        async _safeExecuteAsync(fn, context, ...args) {
            try {
                return await fn.apply(this, args);
            } catch (error) {
                throw this._handleError(error, context);
            }
        }

        // Create a real JS class from collected method descriptors without
        // closing over the compiler/generator locals. `methods` is an array of
        // { name, params, body, type } objects. `envNames` / `envValues` are
        // parallel arrays of identifier names (e.g. b0, executeInCompatibilityLayer)
        // and their runtime values captured from the compiler scope and passed
        // in by the compiled class builder. This constructs a class and attaches
        // methods using `new Function` so the resulting method functions do not
        // keep a reference to the compiler's local scope (fixes TurboWarp issues).
        _makeClassFromMethods(methods, envNames = [], envValues = []) {
            try {
                const C = class {};

                const escapeRegExp = (str) =>
                    String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

                for (const m of methods || []) {
                    const name = String(m.name || "");
                    const params = Array.isArray(m.params)
                        ? m.params.map((p) => String(p))
                        : [];
                    let body = String(m.body || "");
                    const type = String(m.type || "");

                    // Private method marker '#' isn't usable via defineProperty; strip it.
                    const cleanName = name.startsWith("#")
                        ? name.slice(1)
                        : name;

                    // Rewrite env names to unique closure parameters so the generated
                    // method source does not still depend on compile-time temporary names.
                    const safeParamNames = envNames.map(
                        (envName, idx) => `__jsoop_env_${idx}__`,
                    );
                    for (let i = 0; i < envNames.length; i++) {
                        const envName = envNames[i];
                        const safeName = safeParamNames[i];
                        const re = new RegExp(
                            "\\b" + escapeRegExp(envName) + "\\b",
                            "g",
                        );
                        body = body.replace(re, safeName);
                    }

                    // Always create factory methods so they interoperate with the
                    // TurboWarp compiler/scheduler and receive a cloned thread with
                    // named JSOOP args instead of positional block args.
                    const factorySrc =
                        "(function(thread" +
                        (params.length ? ", " + params.join(",") : "") +
                        ") { return (function*() {" +
                        body +
                        "}); })";
                    const factory = new Function(
                        ...safeParamNames,
                        "return " + factorySrc,
                    );
                    const fn = factory(...envValues);
                    try {
                        Object.defineProperty(fn, "_jsoopMethod", {
                            value: true,
                            writable: false,
                            configurable: true,
                        });
                        Object.defineProperty(fn, "_jsoopFactory", {
                            value: true,
                            writable: false,
                            configurable: true,
                        });
                        Object.defineProperty(fn, "_jsoopParams", {
                            value: params.slice(),
                            writable: false,
                            configurable: true,
                        });
                        try {
                            Object.defineProperty(fn, "_jsoopDefaults", {
                                value: m.defaults || {},
                                writable: false,
                                configurable: true,
                            });
                        } catch (_) {}
                        try {
                            if (m && m.firstBlockId) {
                                Object.defineProperty(
                                    fn,
                                    "_jsoopFirstBlockId",
                                    {
                                        value: m.firstBlockId,
                                        writable: false,
                                        configurable: true,
                                    },
                                );
                            }
                        } catch (_) {}
                        try {
                            if (m && m.thread) {
                                Object.defineProperty(
                                    fn,
                                    "_jsoopAttachedThread",
                                    {
                                        value: m.thread,
                                        writable: false,
                                        configurable: true,
                                    },
                                );
                            }
                        } catch (_) {}
                    } catch (_) {
                        /* ignore */
                    }

                    if (type.includes("static")) {
                        Object.defineProperty(C, cleanName, {
                            value: fn,
                            writable: true,
                            configurable: true,
                        });
                    } else if (
                        type.includes("getter") ||
                        type.includes("setter")
                    ) {
                        const desc = {};
                        if (type.includes("getter")) desc.get = fn;
                        if (type.includes("setter")) desc.set = fn;
                        Object.defineProperty(C.prototype, cleanName, desc);
                    } else {
                        Object.defineProperty(C.prototype, cleanName, {
                            value: fn,
                            writable: true,
                            configurable: true,
                        });
                    }
                }

                return C;
            } catch (e) {
                console.error("_makeClassFromMethods failed", e);
                return function () {};
            }
        }

        _isJsoopFactory(fn) {
            return (
                typeof fn === "function" &&
                (fn._jsoopFactory === true ||
                    !!fn._jsoopAttachedThread ||
                    !!fn._jsoopFirstBlockId)
            );
        }

        _getJsoopParamNames(fn) {
            if (!fn || !Array.isArray(fn._jsoopParams)) return [];
            return fn._jsoopParams.map((param) => {
                const name = String(param || "").trim();
                const match = name.match(/^\.{0,3}\s*([A-Za-z_$][\w$]*)/);
                return match ? match[1] : null;
            });
        }

        _isGeneratorFunction(fn) {
            return (
                typeof fn === "function" &&
                fn.constructor &&
                fn.constructor.name === "GeneratorFunction"
            );
        }

        async _runJsoopGenerator(genOrFunc) {
            let iterator;
            if (typeof genOrFunc === "function") {
                iterator = genOrFunc();
            } else {
                iterator = genOrFunc;
            }
            if (!iterator || typeof iterator.next !== "function")
                return iterator;

            let result = await iterator.next();
            while (!result.done) {
                try {
                    const value = await result.value;
                    result = await iterator.next(value);
                } catch (e) {
                    result = await iterator.throw(e);
                }
            }
            return result.value;
        }

        async _invokeJsoopFactory(fn, callerThis, thread, args) {
            const paramNames = this._getJsoopParamNames(fn);
            const defaults = fn && fn._jsoopDefaults ? fn._jsoopDefaults : {};

            const argObject = {};
            for (let i = 0; i < paramNames.length; i++) {
                const key = paramNames[i] || String(i);
                const value = i < args.length ? args[i] : undefined;
                argObject[key] =
                    value === undefined &&
                    Object.prototype.hasOwnProperty.call(defaults, key)
                        ? defaults[key]
                        : value;
            }

            const resolvedThis =
                callerThis instanceof JSObject ? callerThis.value : callerThis;

            try {
                const attachedThread =
                    fn && fn._jsoopAttachedThread
                        ? fn._jsoopAttachedThread
                        : null;

                const methodTarget =
                    fn?._jsoopOwnerTarget ||
                    attachedThread?._jsoopOwnerTarget ||
                    attachedThread?.target ||
                    thread?._jsoopMethodTarget ||
                    null;

                const callerTarget =
                    thread?._jsoopCallerTarget || thread?.target || null;

                let id = null;

                if (fn && fn._jsoopFirstBlockId) {
                    id = fn._jsoopFirstBlockId;
                } else if (attachedThread) {
                    if (attachedThread.topBlock) {
                        id = attachedThread.topBlock;
                    } else if (
                        attachedThread.stack &&
                        attachedThread.stack.length > 0
                    ) {
                        id = attachedThread.stack[0];
                    } else if (
                        attachedThread.blockContainer &&
                        attachedThread.blockContainer._blocks
                    ) {
                        const keys = Object.keys(
                            attachedThread.blockContainer._blocks,
                        );
                        if (keys.length > 0) id = keys[0];
                    }
                }

                if (!id || !methodTarget) return;

                const blockExists =
                    (methodTarget.blocks &&
                        ((typeof methodTarget.blocks.getBlock === "function" &&
                            methodTarget.blocks.getBlock(id)) ||
                            (methodTarget.blocks._blocks &&
                                methodTarget.blocks._blocks[id]))) ||
                    false;

                if (!blockExists) {
                    console.error(
                        "[JSOOP] Block not found on method target:",
                        id,
                        methodTarget,
                    );
                    return;
                }

                const newThread = this.runtime._pushThread(id, methodTarget, {
                    stackClick: true,
                    updateMonitor: false,
                });

                if (!newThread) return;

                newThread.jsoopArgs = argObject;
                newThread.jsoopThis = resolvedThis;

                newThread._jsoopCallerTarget = callerTarget;
                newThread._jsoopMethodTarget = methodTarget;

                newThread.parentThread = thread || null;

                return new Promise((resolve) => {
                    const check = () => {
                        if (!this.runtime.threads.includes(newThread)) {
                            resolve();
                        } else {
                            this.runtime.once("AFTER_EXECUTE", check);
                        }
                    };
                    check();
                });
            } catch (e) {
                console.error("JSOOP factory invoke error:", e);
            }
        }

        getInfo() {
            // ... (blocks array remains exactly the same as in the previous version)
            const blocks = [
                {
                    opcode: "codeInput",
                    color1: "#6b8cff",
                    color2: "#6b8cff",
                    color3: "#6b8cff",
                    text: "[CODE]",
                    blockType: Scratch.BlockType.REPORTER,
                    blockShape: Scratch.BlockShape.SQUARE,
                    hideFromPalette: true,
                    arguments: {
                        CODE: {
                            type: Scratch.ArgumentType.CUSTOM,
                            id: "jsoop-codeEditor",
                            defaultValue: "jsoop-init-xyz789@!",
                        },
                    },
                },
                {
                    opcode: "argsReporter",
                    text: "args",
                    blockType: Scratch.BlockType.REPORTER,
                    hideFromPalette: true,
                    canDragDuplicate: true,
                    allowDropAnywhere: true,
                    disableMonitor: true,
                },
                {
                    opcode: "evalJS",
                    color1: "#6b8cff",
                    color2: "#6b8cff",
                    color3: "#6b8cff",
                    blockType: Scratch.BlockType.REPORTER,
                    text: "eval JS [CODE]",
                    arguments: {
                        CODE: {
                            fillIn: "codeInput",
                        },
                    },
                    ...JSObjectDescriptor.Block,
                },
                {
                    opcode: "runJS",
                    color1: "#6b8cff",
                    color2: "#6b8cff",
                    color3: "#6b8cff",
                    blockType: Scratch.BlockType.COMMAND,
                    text: "run JS [CODE]",
                    arguments: {
                        CODE: {
                            fillIn: "codeInput",
                        },
                    },
                },
                {
                    opcode: "jsCommand",
                    text: "run [CODE]",
                    blockType: Scratch.BlockType.COMMAND,
                    hideFromPalette: isScratchBlocksReady && !isSafari,
                    arguments: {
                        CODE: {
                            type: Scratch.ArgumentType.STRING,
                            defaultValue: `console.log("Hello!")`,
                        },
                    },
                },
                {
                    opcode: "jsReporter",
                    text: "run [CODE]",
                    blockType: Scratch.BlockType.REPORTER,
                    disableMonitor: true,
                    allowDropAnywhere: true,
                    hideFromPalette: isScratchBlocksReady && !isSafari,
                    arguments: {
                        CODE: {
                            type: Scratch.ArgumentType.STRING,
                            defaultValue: "Math.random()",
                        },
                    },
                },
                {
                    opcode: "functionHatNotice",
                    blockType: Scratch.BlockType.BUTTON,
                    text: "Notice, read me!",
                },
                {
                    opcode: "functionHat",
                    text: "when function [LABEL] is called [ARGS]",
                    blockType: Scratch.BlockType.HAT,
                    isEdgeActivated: false,
                    hideFromPalette: true,
                    arguments: {
                        LABEL: {
                            type: Scratch.ArgumentType.STRING,
                            defaultValue: "myFunction",
                        },
                        ARGS: {
                            fillIn: "argsReporter",
                        },
                    },
                },
                {
                    blockType: Scratch.BlockType.XML,
                    hideFromPalette: false,
                    xml: `
          <block type="jsoop_functionHat">
          <value name="LABEL"><shadow type="text"><field name="TEXT">myFunction</field></shadow></value>
          <value name="ARGS"><shadow type="jsoop_argsReporter"></shadow></value>
          <next>
          <block type="jsoop_returnDataString">
          <value name="DATA"><shadow type="text"><field name="TEXT">foobar</field></shadow></value>
          </block>
          </next>
          </block>
          `,
                },
                {
                    opcode: "functionReporter",
                    text: "generate function for label [LABEL]",
                    blockType: Scratch.BlockType.REPORTER,
                    arguments: {
                        LABEL: {
                            type: Scratch.ArgumentType.STRING,
                            defaultValue: "myFunction",
                        },
                    },
                    ...JSObjectDescriptor.Block,
                },
                {
                    opcode: "returnDataString",
                    blockType: Scratch.BlockType.COMMAND,
                    isTerminal: true,
                    hideFromPalette: false,
                    text: "return [DATA]",
                    arguments: {
                        DATA: {
                            type: Scratch.ArgumentType.STRING,
                            defaultValue: "foobar",
                        },
                    },
                },
                {
                    opcode: "returnDataObject",
                    blockType: Scratch.BlockType.COMMAND,
                    isTerminal: true,
                    hideFromPalette: false,
                    text: "return [DATA]",
                    arguments: {
                        DATA: {
                            ...(vm.dogeiscutObject
                                ? {
                                      ...vm.dogeiscutObject.Argument,
                                  }
                                : {
                                      ...{
                                          shape: 5,
                                          exemptFromNormalization: true,
                                          check: ["Object"],
                                      },
                                  }),
                            defaultValue: vm.dogeiscutObject
                                ? vm.dogeiscutObject.Type.defaultValue
                                : undefined,
                        },
                    },
                },
                {
                    opcode: "returnDataArray",
                    blockType: Scratch.BlockType.COMMAND,
                    isTerminal: true,
                    hideFromPalette: false,
                    text: "return [DATA]",
                    arguments: {
                        DATA: {
                            ...jwArray.Argument,
                            defaultValue: new jwArray.Type([]),
                        },
                    },
                },
                {
                    opcode: "returnDataJsObject",
                    blockType: Scratch.BlockType.COMMAND,
                    isTerminal: true,
                    hideFromPalette: false,
                    text: "return [DATA]",
                    arguments: {
                        DATA: JSObjectDescriptor.Argument,
                    },
                },
                {
                    opcode: "new",
                    blockType: Scratch.BlockType.REPORTER,
                    text: "new [CONSTRUCTOR] with args [ARGS]",
                    arguments: {
                        CONSTRUCTOR: JSObjectDescriptor.Argument,
                        ARGS: {
                            ...jwArray.Argument,
                            defaultValue: new jwArray.Type([]),
                        },
                    },
                    ...JSObjectDescriptor.Block,
                },
                {
                    opcode: "callMethod",
                    blockType: Scratch.BlockType.REPORTER,
                    text: "call method [METHOD] on [INSTANCE] with args [ARGS]",
                    arguments: {
                        METHOD: {
                            type: Scratch.ArgumentType.STRING,
                            defaultValue: "toString",
                            exemptFromNormalization: true,
                        },
                        INSTANCE: JSObjectDescriptor.Argument,
                        ARGS: {
                            ...jwArray.Argument,
                            defaultValue: new jwArray.Type([]),
                        },
                    },
                    ...JSObjectDescriptor.Block,
                },
                {
                    opcode: "awaitCallMethod",
                    blockType: Scratch.BlockType.REPORTER,
                    text: "await call method [METHOD] on [INSTANCE] with args [ARGS]",
                    arguments: {
                        METHOD: {
                            type: Scratch.ArgumentType.STRING,
                            defaultValue: "then",
                            exemptFromNormalization: true,
                        },
                        INSTANCE: JSObjectDescriptor.Argument,
                        ARGS: {
                            ...jwArray.Argument,
                            defaultValue: new jwArray.Type([]),
                        },
                    },
                    ...JSObjectDescriptor.Block,
                },
                {
                    opcode: "runMethod",
                    blockType: Scratch.BlockType.COMMAND,
                    text: "run method [METHOD] on [INSTANCE] with args [ARGS]",
                    arguments: {
                        METHOD: {
                            type: Scratch.ArgumentType.STRING,
                            defaultValue: "setName",
                            exemptFromNormalization: true,
                        },
                        INSTANCE: JSObjectDescriptor.Argument,
                        ARGS: {
                            ...jwArray.Argument,
                            defaultValue: new jwArray.Type([]),
                        },
                    },
                },
                {
                    opcode: "awaitRunMethod",
                    blockType: Scratch.BlockType.COMMAND,
                    text: "await run method [METHOD] on [INSTANCE] with args [ARGS]",
                    arguments: {
                        METHOD: {
                            type: Scratch.ArgumentType.STRING,
                            defaultValue: "then",
                            exemptFromNormalization: true,
                        },
                        INSTANCE: JSObjectDescriptor.Argument,
                        ARGS: {
                            ...jwArray.Argument,
                            defaultValue: new jwArray.Type([]),
                        },
                    },
                },
                {
                    opcode: "callFunction",
                    blockType: Scratch.BlockType.REPORTER,
                    text: "call function [FUNC] with this [THIS] args [ARGS]",
                    arguments: {
                        FUNC: JSObjectDescriptor.Argument,
                        THIS: {
                            ...(vm.dogeiscutObject
                                ? {
                                      ...vm.dogeiscutObject.Argument,
                                  }
                                : {
                                      ...{
                                          shape: 5,
                                          exemptFromNormalization: true,
                                          check: ["Object"],
                                      },
                                  }),
                            defaultValue: vm.dogeiscutObject
                                ? vm.dogeiscutObject.Type.defaultValue
                                : undefined,
                        },
                        ARGS: {
                            ...jwArray.Argument,
                            defaultValue: new jwArray.Type([]),
                        },
                    },
                    ...JSObjectDescriptor.Block,
                },
                {
                    opcode: "awaitCallFunction",
                    blockType: Scratch.BlockType.REPORTER,
                    text: "await call function [FUNC] with this [THIS] args [ARGS]",
                    arguments: {
                        FUNC: JSObjectDescriptor.Argument,
                        THIS: {
                            ...(vm.dogeiscutObject
                                ? {
                                      ...vm.dogeiscutObject.Argument,
                                  }
                                : {
                                      ...{
                                          shape: 5,
                                          exemptFromNormalization: true,
                                          check: ["Object"],
                                      },
                                  }),
                            defaultValue: vm.dogeiscutObject
                                ? vm.dogeiscutObject.Type.defaultValue
                                : undefined,
                        },
                        ARGS: {
                            ...jwArray.Argument,
                            defaultValue: new jwArray.Type([]),
                        },
                    },
                    ...JSObjectDescriptor.Block,
                },
                {
                    opcode: "runFunction",
                    blockType: Scratch.BlockType.COMMAND,
                    text: "run function [FUNC] with this [THIS] args [ARGS]",
                    arguments: {
                        FUNC: JSObjectDescriptor.Argument,
                        THIS: {
                            ...(vm.dogeiscutObject
                                ? {
                                      ...vm.dogeiscutObject.Argument,
                                  }
                                : {
                                      ...{
                                          shape: 5,
                                          exemptFromNormalization: true,
                                          check: ["Object"],
                                      },
                                  }),
                            defaultValue: vm.dogeiscutObject
                                ? vm.dogeiscutObject.Type.defaultValue
                                : undefined,
                        },
                        ARGS: {
                            ...jwArray.Argument,
                            defaultValue: new jwArray.Type([]),
                        },
                    },
                },
                {
                    opcode: "awaitRunFunction",
                    blockType: Scratch.BlockType.COMMAND,
                    text: "await run function [FUNC] with this [THIS] args [ARGS]",
                    arguments: {
                        FUNC: JSObjectDescriptor.Argument,
                        THIS: {
                            ...(vm.dogeiscutObject
                                ? {
                                      ...vm.dogeiscutObject.Argument,
                                  }
                                : {
                                      ...{
                                          shape: 5,
                                          exemptFromNormalization: true,
                                          check: ["Object"],
                                      },
                                  }),
                            defaultValue: vm.dogeiscutObject
                                ? vm.dogeiscutObject.Type.defaultValue
                                : undefined,
                        },
                        ARGS: {
                            ...jwArray.Argument,
                            defaultValue: new jwArray.Type([]),
                        },
                    },
                },
                {
                    opcode: "getProp",
                    blockType: Scratch.BlockType.REPORTER,
                    text: "get property [PROP] of [INSTANCE]",
                    allowDropAnywhere: true,
                    arguments: {
                        PROP: {
                            type: Scratch.ArgumentType.STRING,
                            defaultValue: "name",
                            exemptFromNormalization: true,
                        },
                        INSTANCE: JSObjectDescriptor.Argument,
                    },
                },
                {
                    opcode: "stringify",
                    blockType: Scratch.BlockType.REPORTER,
                    text: "JSON stringify [VALUE]",
                    arguments: {
                        VALUE: {
                            type: Scratch.ArgumentType.STRING,
                            defaultValue: '{"a":1}',
                            exemptFromNormalization: true,
                        },
                    },
                },
                {
                    opcode: "typeName",
                    blockType: Scratch.BlockType.REPORTER,
                    text: "type name of [INSTANCE]",
                    arguments: {
                        INSTANCE: JSObjectDescriptor.Argument,
                    },
                },
                {
                    opcode: "toNative",
                    blockType: Scratch.BlockType.REPORTER,
                    text: "Convert to native JavaScript value [VALUE]",
                    allowDropAnywhere: true,
                    arguments: {
                        VALUE: JSObjectDescriptor.Argument,
                    },
                },
                {
                    opcode: "separator2",
                    blockType: Scratch.BlockType.LABEL,
                    text: "Property Changing Blocks",
                },
                {
                    opcode: "propSettingNotice",
                    blockType: Scratch.BlockType.BUTTON,
                    text: "Notice, read me!",
                },
                {
                    opcode: "setPropString",
                    blockType: Scratch.BlockType.COMMAND,
                    text: "set property [PROP] of [INSTANCE] to string [VALUE]",
                    arguments: {
                        PROP: {
                            type: Scratch.ArgumentType.STRING,
                            defaultValue: "name",
                            exemptFromNormalization: true,
                        },
                        INSTANCE: JSObjectDescriptor.Argument,
                        VALUE: {
                            type: Scratch.ArgumentType.STRING,
                            defaultValue: "Bob",
                        },
                    },
                },
                {
                    opcode: "setPropJSObject",
                    blockType: Scratch.BlockType.COMMAND,
                    text: "set property [PROP] of [INSTANCE] to JavaScript Object [VALUE]",
                    arguments: {
                        PROP: {
                            type: Scratch.ArgumentType.STRING,
                            defaultValue: "data",
                            exemptFromNormalization: true,
                        },
                        INSTANCE: JSObjectDescriptor.Argument,
                        VALUE: JSObjectDescriptor.Argument,
                    },
                },
                {
                    opcode: "setPropJwArray",
                    blockType: Scratch.BlockType.COMMAND,
                    text: "set property [PROP] of [INSTANCE] to Array [VALUE]",
                    arguments: {
                        PROP: {
                            type: Scratch.ArgumentType.STRING,
                            defaultValue: "items",
                            exemptFromNormalization: true,
                        },
                        INSTANCE: JSObjectDescriptor.Argument,
                        VALUE: {
                            ...jwArray.Argument,
                            defaultValue: new jwArray.Type([]),
                        },
                    },
                },
                {
                    opcode: "setPropDogeiscutObject",
                    blockType: Scratch.BlockType.COMMAND,
                    text: "set property [PROP] of [INSTANCE] to Object [VALUE]",
                    arguments: {
                        PROP: {
                            type: Scratch.ArgumentType.STRING,
                            defaultValue: "config",
                            exemptFromNormalization: true,
                        },
                        INSTANCE: JSObjectDescriptor.Argument,
                        VALUE: vm.dogeiscutObject
                            ? {
                                  ...vm.dogeiscutObject.Argument,
                              }
                            : {
                                  ...{
                                      shape: 5,
                                      exemptFromNormalization: true,
                                      check: ["Object"],
                                  },
                              },
                    },
                },

                {
                    opcode: "seperator0",
                    blockType: Scratch.BlockType.LABEL,
                    text: "Classes",
                },
                {
                    opcode: "classBuilder",
                    text: "class builder",
                    blockType: Scratch.BlockType.REPORTER,
                    branches: [{}],
                    ...JSObjectDescriptor.Block,
                },
                {
                    opcode: "classMethod",
                    text: "[METHOD_TYPE] method [NAME] args [ARGS]",
                    blockType: Scratch.BlockType.COMMAND,
                    branches: [{}],
                    arguments: {
                        METHOD_TYPE: {
                            type: Scratch.ArgumentType.STRING,
                            menu: "methodTypeMenu",
                            defaultValue: "method",
                        },
                        NAME: {
                            type: Scratch.ArgumentType.STRING,
                            defaultValue: "myMethod",
                        },
                        ARGS: jwArray.Argument,
                    },
                },
                {
                    opcode: "classArg",
                    text: "arg [NAME]",
                    blockType: Scratch.BlockType.REPORTER,
                    arguments: {
                        NAME: {
                            type: Scratch.ArgumentType.STRING,
                            defaultValue: "x",
                        },
                    },
                },
                {
                    opcode: "classArgString",
                    text: "arg [NAME] default string [DEFAULT]",
                    blockType: Scratch.BlockType.REPORTER,
                    arguments: {
                        NAME: {
                            type: Scratch.ArgumentType.STRING,
                            defaultValue: "x",
                        },
                        DEFAULT: {
                            type: Scratch.ArgumentType.STRING,
                            defaultValue: "hello",
                        },
                    },
                },
                {
                    opcode: "classArgNumber",
                    text: "arg [NAME] default number [DEFAULT]",
                    blockType: Scratch.BlockType.REPORTER,
                    arguments: {
                        NAME: {
                            type: Scratch.ArgumentType.STRING,
                            defaultValue: "x",
                        },
                        DEFAULT: {
                            type: Scratch.ArgumentType.NUMBER,
                            defaultValue: 0,
                        },
                    },
                },
                {
                    opcode: "classArgDogeiscutObject",
                    text: "arg [NAME] default object [DEFAULT]",
                    blockType: Scratch.BlockType.REPORTER,
                    arguments: {
                        NAME: {
                            type: Scratch.ArgumentType.STRING,
                            defaultValue: "x",
                        },
                        DEFAULT: vm.dogeiscutObject
                            ? {
                                  ...vm.dogeiscutObject.Argument,
                              }
                            : {
                                  shape: 5,
                                  exemptFromNormalization: true,
                                  check: ["Object"],
                              },
                    },
                },
                {
                    opcode: "classArgJwArray",
                    text: "arg [NAME] default array [DEFAULT]",
                    blockType: Scratch.BlockType.REPORTER,
                    arguments: {
                        NAME: {
                            type: Scratch.ArgumentType.STRING,
                            defaultValue: "x",
                        },
                        DEFAULT: {
                            ...jwArray.Argument,
                            defaultValue: new jwArray.Type([]),
                        },
                    },
                },
                {
                    opcode: "classArgJSObject",
                    text: "arg [NAME] default JSObject [DEFAULT]",
                    blockType: Scratch.BlockType.REPORTER,
                    arguments: {
                        NAME: {
                            type: Scratch.ArgumentType.STRING,
                            defaultValue: "x",
                        },
                        DEFAULT: JSObjectDescriptor.Argument,
                    },
                },
                {
                    opcode: "classArgDefault",
                    text: "arg [NAME] default [DEFAULT]",
                    blockType: Scratch.BlockType.REPORTER,
                    arguments: {
                        NAME: {
                            type: Scratch.ArgumentType.STRING,
                            defaultValue: "x",
                        },
                        DEFAULT: {
                            type: Scratch.ArgumentType.STRING,
                            defaultValue: "0",
                        },
                    },
                },
                {
                    opcode: "classArgSpread",
                    text: "spread [NAME]",
                    blockType: Scratch.BlockType.REPORTER,
                    arguments: {
                        NAME: {
                            type: Scratch.ArgumentType.STRING,
                            defaultValue: "rest",
                        },
                    },
                },
                {
                    opcode: "classThis",
                    text: "this",
                    blockType: Scratch.BlockType.REPORTER,
                    allowDropAnywhere: true,
                    hideFromPalette: false,
                    disableMonitor: true,
                },
                {
                    opcode: "separator1",
                    blockType: Scratch.BlockType.LABEL,
                    text: "Common JavaScript Constants",
                },
                {
                    opcode: "constantMath",
                    blockType: Scratch.BlockType.REPORTER,
                    text: "Math",
                    ...JSObjectDescriptor.Block,
                },
                {
                    opcode: "constantNull",
                    blockType: Scratch.BlockType.REPORTER,
                    text: "null",
                    ...JSObjectDescriptor.Block,
                },
                {
                    opcode: "constantUndefined",
                    blockType: Scratch.BlockType.REPORTER,
                    text: "undefined",
                    ...JSObjectDescriptor.Block,
                },
                {
                    opcode: "constantObject",
                    blockType: Scratch.BlockType.REPORTER,
                    text: "Object",
                    ...JSObjectDescriptor.Block,
                },
                {
                    opcode: "constantArray",
                    blockType: Scratch.BlockType.REPORTER,
                    text: "Array",
                    ...JSObjectDescriptor.Block,
                },
                {
                    opcode: "constantString",
                    blockType: Scratch.BlockType.REPORTER,
                    text: "String",
                    ...JSObjectDescriptor.Block,
                },
                {
                    opcode: "constantNumber",
                    blockType: Scratch.BlockType.REPORTER,
                    text: "Number",
                    ...JSObjectDescriptor.Block,
                },
                {
                    opcode: "constantBoolean",
                    blockType: Scratch.BlockType.REPORTER,
                    text: "Boolean",
                    ...JSObjectDescriptor.Block,
                },
                {
                    opcode: "constantFunction",
                    blockType: Scratch.BlockType.REPORTER,
                    text: "Function",
                    ...JSObjectDescriptor.Block,
                },
                {
                    opcode: "constantAsyncFunction",
                    blockType: Scratch.BlockType.REPORTER,
                    text: "AsyncFunction",
                    ...JSObjectDescriptor.Block,
                },
                {
                    opcode: "constantDate",
                    blockType: Scratch.BlockType.REPORTER,
                    text: "Date",
                    ...JSObjectDescriptor.Block,
                },
                {
                    opcode: "constantRegExp",
                    blockType: Scratch.BlockType.REPORTER,
                    text: "RegExp",
                    ...JSObjectDescriptor.Block,
                },
                {
                    opcode: "constantJSON",
                    blockType: Scratch.BlockType.REPORTER,
                    text: "JSON",
                    ...JSObjectDescriptor.Block,
                },
                {
                    opcode: "constantPromise",
                    blockType: Scratch.BlockType.REPORTER,
                    text: "Promise",
                    ...JSObjectDescriptor.Block,
                },
                {
                    opcode: "constantError",
                    blockType: Scratch.BlockType.REPORTER,
                    text: "Error",
                    ...JSObjectDescriptor.Block,
                },
                {
                    opcode: "constantMap",
                    blockType: Scratch.BlockType.REPORTER,
                    text: "Map",
                    ...JSObjectDescriptor.Block,
                },
                {
                    opcode: "constantSet",
                    blockType: Scratch.BlockType.REPORTER,
                    text: "Set",
                    ...JSObjectDescriptor.Block,
                },
                {
                    opcode: "constantWeakMap",
                    blockType: Scratch.BlockType.REPORTER,
                    text: "WeakMap",
                    ...JSObjectDescriptor.Block,
                },
                {
                    opcode: "constantWeakSet",
                    blockType: Scratch.BlockType.REPORTER,
                    text: "WeakSet",
                    ...JSObjectDescriptor.Block,
                },
                {
                    opcode: "constantSymbol",
                    blockType: Scratch.BlockType.REPORTER,
                    text: "Symbol",
                    ...JSObjectDescriptor.Block,
                },
                {
                    opcode: "constantProxy",
                    blockType: Scratch.BlockType.REPORTER,
                    text: "Proxy",
                    ...JSObjectDescriptor.Block,
                },
                {
                    opcode: "constantReflect",
                    blockType: Scratch.BlockType.REPORTER,
                    text: "Reflect",
                    ...JSObjectDescriptor.Block,
                },
                {
                    opcode: "constantIntl",
                    blockType: Scratch.BlockType.REPORTER,
                    text: "Intl",
                    ...JSObjectDescriptor.Block,
                },
                {
                    opcode: "constantConsole",
                    blockType: Scratch.BlockType.REPORTER,
                    text: "console",
                    ...JSObjectDescriptor.Block,
                },
                {
                    opcode: "constantGlobalThis",
                    blockType: Scratch.BlockType.REPORTER,
                    text: "globalThis",
                    ...JSObjectDescriptor.Block,
                },
                {
                    opcode: "constantInfinity",
                    blockType: Scratch.BlockType.REPORTER,
                    text: "Infinity",
                    ...JSObjectDescriptor.Block,
                },
                {
                    opcode: "constantNaN",
                    blockType: Scratch.BlockType.REPORTER,
                    text: "NaN",
                    ...JSObjectDescriptor.Block,
                },
            ];

            return {
                id: "jsoop",
                name: "JS OOP",
                color1: "#6b8cff",
                color2: "#4968d9",
                color3: "#334fb7",
                blocks: blocks,
                menus: {
                    methodTypeMenu: {
                        acceptReporters: false,
                        items: [
                            "method",
                            "static method",
                            "getter",
                            "setter",
                            "async method",
                            "async static method",
                            "private method",
                            "private static method",
                            "private getter",
                            "private setter",
                            "private async method",
                            "private async static method",
                        ],
                    },
                },
            };
        }

        getCompileInfo() {
            return {
                ir: {
                    classBuilder: (generator, block) => {
                        generator.script.yields = true;
                        return {
                            kind: "input",
                            substack: generator.descendSubstack(
                                block,
                                "SUBSTACK",
                            ),
                        };
                    },
                    classMethod: (generator, block) => {
                        return {
                            kind: "stack",
                            type: block.fields.METHOD_TYPE.value,
                            name: generator.descendInputOfBlock(block, "NAME"),
                            args: generator.descendInputOfBlock(block, "ARGS"),
                            substack: generator.descendSubstack(
                                block,
                                "SUBSTACK",
                            ),
                        };
                    },
                    new: (generator, block) => {
                        generator.script.yields = true;
                        return {
                            kind: "input",
                            CONSTRUCTOR: generator.descendInputOfBlock(
                                block,
                                "CONSTRUCTOR",
                            ),
                            ARGS: generator.descendInputOfBlock(block, "ARGS"),
                        };
                    },
                    classThis: (generator, block) => ({ kind: "input" }),
                    returnDataString: (generator, block) => ({
                        kind: "stack",
                        DATA: generator.descendInputOfBlock(block, "DATA"),
                    }),
                    returnDataObject: (generator, block) => ({
                        kind: "stack",
                        DATA: generator.descendInputOfBlock(block, "DATA"),
                    }),
                    returnDataArray: (generator, block) => ({
                        kind: "stack",
                        DATA: generator.descendInputOfBlock(block, "DATA"),
                    }),
                    returnDataJsObject: (generator, block) => ({
                        kind: "stack",
                        DATA: generator.descendInputOfBlock(block, "DATA"),
                    }),
                    argsReporter: (generator, block) => ({ kind: "input" }),
                    classArg: (generator, block) => ({
                        kind: "input",
                        NAME: generator.descendInputOfBlock(block, "NAME"),
                    }),
                    classArgString: (generator, block) => ({
                        kind: "input",
                        NAME: generator.descendInputOfBlock(block, "NAME"),
                        DEFAULT: generator.descendInputOfBlock(
                            block,
                            "DEFAULT",
                        ),
                    }),
                    classArgNumber: (generator, block) => ({
                        kind: "input",
                        NAME: generator.descendInputOfBlock(block, "NAME"),
                        DEFAULT: generator.descendInputOfBlock(
                            block,
                            "DEFAULT",
                        ),
                    }),
                    classArgDogeiscutObject: (generator, block) => ({
                        kind: "input",
                        NAME: generator.descendInputOfBlock(block, "NAME"),
                        DEFAULT: generator.descendInputOfBlock(
                            block,
                            "DEFAULT",
                        ),
                    }),
                    classArgJwArray: (generator, block) => ({
                        kind: "input",
                        NAME: generator.descendInputOfBlock(block, "NAME"),
                        DEFAULT: generator.descendInputOfBlock(
                            block,
                            "DEFAULT",
                        ),
                    }),
                    classArgJSObject: (generator, block) => ({
                        kind: "input",
                        NAME: generator.descendInputOfBlock(block, "NAME"),
                        DEFAULT: generator.descendInputOfBlock(
                            block,
                            "DEFAULT",
                        ),
                    }),
                    classArgDefault: (generator, block) => ({
                        kind: "input",
                        NAME: generator.descendInputOfBlock(block, "NAME"),
                        DEFAULT: generator.descendInputOfBlock(
                            block,
                            "DEFAULT",
                        ),
                    }),
                    classArgSpread: (generator, block) => ({
                        kind: "input",
                        NAME: generator.descendInputOfBlock(block, "NAME"),
                    }),
                    constantMath: (generator, block) => ({ kind: "input" }),
                    constantNull: (generator, block) => ({ kind: "input" }),
                    constantUndefined: (generator, block) => ({
                        kind: "input",
                    }),
                    constantObject: (generator, block) => ({ kind: "input" }),
                    constantArray: (generator, block) => ({ kind: "input" }),
                    constantString: (generator, block) => ({ kind: "input" }),
                    constantNumber: (generator, block) => ({ kind: "input" }),
                    constantBoolean: (generator, block) => ({ kind: "input" }),
                    constantFunction: (generator, block) => ({ kind: "input" }),
                    constantAsyncFunction: (generator, block) => ({
                        kind: "input",
                    }),
                    constantDate: (generator, block) => ({ kind: "input" }),
                    constantRegExp: (generator, block) => ({ kind: "input" }),
                    constantJSON: (generator, block) => ({ kind: "input" }),
                    constantPromise: (generator, block) => ({ kind: "input" }),
                    constantError: (generator, block) => ({ kind: "input" }),
                    constantMap: (generator, block) => ({ kind: "input" }),
                    constantSet: (generator, block) => ({ kind: "input" }),
                    constantWeakMap: (generator, block) => ({ kind: "input" }),
                    constantWeakSet: (generator, block) => ({ kind: "input" }),
                    constantSymbol: (generator, block) => ({ kind: "input" }),
                    constantProxy: (generator, block) => ({ kind: "input" }),
                    constantReflect: (generator, block) => ({ kind: "input" }),
                    constantIntl: (generator, block) => ({ kind: "input" }),
                    constantConsole: (generator, block) => ({ kind: "input" }),
                    constantGlobalThis: (generator, block) => ({
                        kind: "input",
                    }),
                    constantInfinity: (generator, block) => ({ kind: "input" }),
                    constantNaN: (generator, block) => ({ kind: "input" }),
                    callMethod: (generator, block) => {
                        generator.script.yields = true;
                        return {
                            kind: "input",
                            METHOD: generator.descendInputOfBlock(
                                block,
                                "METHOD",
                            ),
                            INSTANCE: generator.descendInputOfBlock(
                                block,
                                "INSTANCE",
                            ),
                            ARGS: generator.descendInputOfBlock(block, "ARGS"),
                        };
                    },
                    runMethod: (generator, block) => {
                        generator.script.yields = true;
                        return {
                            kind: "stack",
                            METHOD: generator.descendInputOfBlock(
                                block,
                                "METHOD",
                            ),
                            INSTANCE: generator.descendInputOfBlock(
                                block,
                                "INSTANCE",
                            ),
                            ARGS: generator.descendInputOfBlock(block, "ARGS"),
                        };
                    },
                    callFunction: (generator, block) => {
                        generator.script.yields = true;
                        return {
                            kind: "input",
                            FUNC: generator.descendInputOfBlock(block, "FUNC"),
                            THIS: generator.descendInputOfBlock(block, "THIS"),
                            ARGS: generator.descendInputOfBlock(block, "ARGS"),
                        };
                    },
                    runFunction: (generator, block) => {
                        generator.script.yields = true;
                        return {
                            kind: "stack",
                            FUNC: generator.descendInputOfBlock(block, "FUNC"),
                            THIS: generator.descendInputOfBlock(block, "THIS"),
                            ARGS: generator.descendInputOfBlock(block, "ARGS"),
                        };
                    },
                    awaitCallMethod: (generator, block) => {
                        generator.script.yields = true;
                        return {
                            kind: "input",
                            METHOD: generator.descendInputOfBlock(
                                block,
                                "METHOD",
                            ),
                            INSTANCE: generator.descendInputOfBlock(
                                block,
                                "INSTANCE",
                            ),
                            ARGS: generator.descendInputOfBlock(block, "ARGS"),
                        };
                    },
                    awaitRunMethod: (generator, block) => {
                        generator.script.yields = true;
                        return {
                            kind: "stack",
                            METHOD: generator.descendInputOfBlock(
                                block,
                                "METHOD",
                            ),
                            INSTANCE: generator.descendInputOfBlock(
                                block,
                                "INSTANCE",
                            ),
                            ARGS: generator.descendInputOfBlock(block, "ARGS"),
                        };
                    },
                    awaitCallFunction: (generator, block) => {
                        generator.script.yields = true;
                        return {
                            kind: "input",
                            FUNC: generator.descendInputOfBlock(block, "FUNC"),
                            THIS: generator.descendInputOfBlock(block, "THIS"),
                            ARGS: generator.descendInputOfBlock(block, "ARGS"),
                        };
                    },
                    awaitRunFunction: (generator, block) => {
                        generator.script.yields = true;
                        return {
                            kind: "stack",
                            FUNC: generator.descendInputOfBlock(block, "FUNC"),
                            THIS: generator.descendInputOfBlock(block, "THIS"),
                            ARGS: generator.descendInputOfBlock(block, "ARGS"),
                        };
                    },
                },
                js: {
                    classBuilder: (node, compiler, imports) => {
                        const originalSource = compiler.source;
                        const methodsVar = compiler.localVariables.next();
                        const sourceVar = compiler.localVariables.next();
                        const paramsVar = compiler.localVariables.next();
                        const typeVar = compiler.localVariables.next();
                        const isAccessorVar = compiler.localVariables.next();
                        const fnVar = compiler.localVariables.next();
                        const cleanNameVar = compiler.localVariables.next();
                        const descVar = compiler.localVariables.next();

                        compiler.source = "(yield* (function*() {";
                        compiler.source += `const waitPromise = function*(promise) {
`;
                        compiler.source += `  const thread = typeof globalState !== 'undefined' && globalState && globalState.thread ? globalState.thread : thread;
`;
                        compiler.source += `  let returnValue;
`;
                        compiler.source += `  let errorReturn;
`;
                        compiler.source += `  let done = false;
`;
                        compiler.source += `
`;
                        compiler.source += `  promise
`;
                        compiler.source += `    .then(value => {
`;
                        compiler.source += `      returnValue = value;
`;
                        compiler.source += `      done = true;
`;
                        compiler.source += `      thread.status = 0; // STATUS_RUNNING
`;
                        compiler.source += `    })
`;
                        compiler.source += `    .catch(error => {
`;
                        compiler.source += `      errorReturn = error;
`;
                        compiler.source += `      done = true;
`;
                        compiler.source += `      thread.status = 0; // STATUS_RUNNING
`;
                        compiler.source += `    });
`;
                        compiler.source += `
`;
                        compiler.source += `  thread.status = 1; // STATUS_PROMISE_WAIT
`;
                        compiler.source += `  while (!done) {
`;
                        compiler.source += `    yield;
`;
                        compiler.source += `  }
`;
                        compiler.source += `
`;
                        compiler.source += `  if (errorReturn) throw errorReturn;
`;
                        compiler.source += `  return returnValue;
`;
                        compiler.source += `};
`;
                        compiler.source += `thread._jsoopClassStack ??= [];`;
                        compiler.source += `let ${methodsVar} = [];`;
                        compiler.source += `thread._jsoopClassStack.push(${methodsVar});`;

                        if (node.substack) {
                            compiler.descendStack(
                                node.substack,
                                new imports.Frame(false, undefined, true),
                            );
                        }

                        compiler.source += `${methodsVar} = thread._jsoopClassStack.pop();`;
                        compiler.source += `const C = vm.runtime.ext_jsoop._makeClassFromMethods(${methodsVar}, [], []);
`;
                        compiler.source += `return new vm.runtime.ext_jsoop.JSObject(C);`;
                        compiler.source += `})())`;

                        const resultSource = compiler.source;
                        compiler.source = originalSource;
                        return new imports.TypedInput(
                            resultSource,
                            imports.TYPE_UNKNOWN,
                        );
                    },

                    classMethod: (node, compiler, imports) => {
                        const oldSource = compiler.source;
                        const oldInClassMethod = compiler.inClassMethod;

                        let factorySource = "";

                        if (node.substack && node.substack.length > 0) {
                            try {
                                const child = Object.create(
                                    Object.getPrototypeOf(compiler),
                                );
                                Object.assign(child, compiler);
                                child.source = "";
                                child.inClassMethod = true;
                                if (
                                    child.localVariables &&
                                    typeof child.localVariables.clone ===
                                        "function"
                                ) {
                                    child.localVariables =
                                        child.localVariables.clone();
                                }

                                const firstBlock = node.substack[0];
                                // Capture first block id for potential runtime thread creation
                                // but avoid performing independent compilation here.
                                const _firstBlock =
                                    firstBlock && firstBlock.id
                                        ? firstBlock.id
                                        : null;

                                if (!factorySource) {
                                    child.descendStack(
                                        node.substack,
                                        new imports.Frame(
                                            false,
                                            undefined,
                                            true,
                                        ),
                                    );
                                    factorySource = child.source;
                                }
                            } finally {
                                compiler.source = oldSource;
                                compiler.inClassMethod = oldInClassMethod;
                            }
                        }

                        // Store the first block id so we can create a runtime Thread when
                        // the class is actually built. This avoids using an independent
                        // compiler at compile-time and lets the method be represented by
                        // a Thread that the sequencer can run.
                        const firstBlockId =
                            node.substack &&
                            node.substack.length > 0 &&
                            node.substack[0] &&
                            node.substack[0].id
                                ? node.substack[0].id
                                : null;

                        const type = node.type;
                        const name = compiler
                            .descendInput(node.name)
                            .asString();
                        const argsExpr = node.args
                            ? compiler.descendInput(node.args).asUnknown()
                            : "new vm.jwArray.Type([])";

                        const tempVar = compiler.localVariables.next();
                        const paramsVar = compiler.localVariables.next();
                        const defaultsVar = compiler.localVariables.next();

                        compiler.source += `let ${tempVar} = ${argsExpr};\n`;
                        compiler.source += `let ${paramsVar} = [];\n`;
                        compiler.source += `let ${defaultsVar} = {};\n`;
                        compiler.source += `if (${tempVar} instanceof vm.jwArray.Type) {\n`;
                        compiler.source += `  for (const item of ${tempVar}.array) {\n`;
                        compiler.source += `    let argObj = item instanceof vm.runtime.ext_jsoop.JSObject ? item.value : item;\n`;
                        compiler.source += `    if (argObj && typeof argObj === 'object' && argObj._jsoopLookupMarker && argObj.lookupId) {\n`;
                        compiler.source += `      argObj = vm.runtime.ext_jsoop._getFromLookupTable(argObj.lookupId);\n`;
                        compiler.source += `      if (argObj instanceof vm.runtime.ext_jsoop.JSObject) argObj = argObj.value;\n`;
                        compiler.source += `    }\n`;
                        compiler.source += `    if (argObj && typeof argObj === 'object') {\n`;
                        compiler.source += `      const keys = Object.keys(argObj);\n`;
                        compiler.source += `      const key = keys[0];\n`;
                        compiler.source += `      if (key !== undefined) {\n`;
                        compiler.source += `        ${paramsVar}.push(String(key));\n`;
                        compiler.source += `        ${defaultsVar}[String(key)] = argObj[key];\n`;
                        compiler.source += `      }\n`;
                        compiler.source += `    }\n`;
                        compiler.source += `  }\n`;
                        compiler.source += `}\n`;
                        compiler.source += `let topStack = thread._jsoopClassStack?.[thread._jsoopClassStack.length-1];\n`;
                        compiler.source += `if (topStack) {\n`;
                        compiler.source += `  topStack.push({\n`;
                        compiler.source += `    name: ${name},\n`;
                        compiler.source += `    params: ${paramsVar},\n`;
                        compiler.source += `    defaults: ${defaultsVar},\n`;
                        compiler.source += `    body: ${JSON.stringify(factorySource)},\n`;
                        compiler.source += `    firstBlockId: ${JSON.stringify(firstBlockId)},\n`;
                        compiler.source += `    type: ${JSON.stringify(type)}\n`;
                        compiler.source += `  });\n`;
                        compiler.source += `};\n`;
                    },

                    new: (node, compiler, imports) => {
                        const ctorExpr = compiler
                            .descendInput(node.CONSTRUCTOR)
                            .asUnknown();
                        const argsExpr = compiler
                            .descendInput(node.ARGS)
                            .asUnknown();

                        const source = `(yield* (function*() {
      try {
        const ctorWrap = ${ctorExpr};
        let ctor = ctorWrap;
        // Resolve lookup marker
        if (ctor && ctor._jsoopLookupMarker && ctor.lookupId) {
          const found = vm.runtime.ext_jsoop._getFromLookupTable(ctor.lookupId);
          if (found instanceof vm.runtime.ext_jsoop.JSObject) ctor = found.value;
          else ctor = found;
        }
        // Unwrap JSObject wrapper
        if (ctor && ctor instanceof vm.runtime.ext_jsoop.JSObject) ctor = ctor.value;

        const args = vm.jwArray.Type.toArray(${argsExpr});
        if (typeof ctor !== 'function') {
          return new vm.runtime.ext_jsoop.JSObject({ error: 'Constructor is not a function' });
        }
        const inst = Reflect.construct(ctor, args);
        return new vm.runtime.ext_jsoop.JSObject(inst);
      } catch (e) {
        return new vm.runtime.ext_jsoop.JSObject({ error: String(e) });
      }
    })())`;

                        return new imports.TypedInput(
                            source,
                            imports.TYPE_UNKNOWN,
                        );
                    },

                    classThis: (node, compiler, imports) => {
                        if (compiler.inClassMethod) {
                            return new imports.TypedInput(
                                "this",
                                imports.TYPE_UNKNOWN,
                            );
                        } else {
                            return new imports.TypedInput(
                                '"this (only works inside class method)"',
                                imports.TYPE_STRING,
                            );
                        }
                    },

                    returnDataString: (node, compiler, imports) => {
                        if (compiler.inClassMethod) {
                            compiler.source += `(thread.justReturned = ${compiler.descendInput(node.DATA).asString()}, thread.stopThisScript(), undefined);`;
                        } else {
                            compiler.source += `(thread.justReturned = ${compiler.descendInput(node.DATA).asString()}, thread.stopThisScript(), '');`;
                        }
                    },
                    returnDataObject: (node, compiler, imports) => {
                        if (compiler.inClassMethod) {
                            compiler.source += `(thread.justReturned = ${compiler.descendInput(node.DATA).asUnknown()}, thread.stopThisScript(), undefined);`;
                        } else {
                            compiler.source += `(thread.justReturned = ${compiler.descendInput(node.DATA).asUnknown()}, thread.stopThisScript(), '');`;
                        }
                    },
                    returnDataArray: (node, compiler, imports) => {
                        if (compiler.inClassMethod) {
                            compiler.source += `(thread.justReturned = ${compiler.descendInput(node.DATA).asUnknown()}, thread.stopThisScript(), undefined);`;
                        } else {
                            compiler.source += `(thread.justReturned = ${compiler.descendInput(node.DATA).asUnknown()}, thread.stopThisScript(), '');`;
                        }
                    },
                    returnDataJsObject: (node, compiler, imports) => {
                        if (compiler.inClassMethod) {
                            compiler.source += `(thread.justReturned = ${compiler.descendInput(node.DATA).asUnknown()}, thread.stopThisScript(), undefined);`;
                        } else {
                            compiler.source += `(thread.justReturned = ${compiler.descendInput(node.DATA).asUnknown()}, thread.stopThisScript(), '');`;
                        }
                    },

                    argsReporter: (node, compiler, imports) => {
                        return new imports.TypedInput(
                            `new vm.jwArray.Type(Object.values(thread.jsoopArgs || {}))`,
                            imports.TYPE_UNKNOWN,
                        );
                    },
                    classArg: (node, compiler, imports) => {
                        const name = node.NAME
                            ? compiler.descendInput(node.NAME).asString()
                            : "";
                        const key = JSON.stringify(name);
                        return new imports.TypedInput(
                            `new vm.runtime.ext_jsoop.JSObject({ [${key}]: undefined })`,
                            imports.TYPE_UNKNOWN,
                        );
                    },
                    classArgString: (node, compiler, imports) => {
                        const name = node.NAME
                            ? compiler.descendInput(node.NAME).asString()
                            : "";
                        const defaultValue = node.DEFAULT
                            ? compiler.descendInput(node.DEFAULT).asUnknown()
                            : "undefined";
                        const key = JSON.stringify(name);
                        return new imports.TypedInput(
                            `(function(){ const argObj = { [${key}]: ${defaultValue} }; return vm.runtime.ext_jsoop._storeClassArgDefault(argObj); })()`,
                            imports.TYPE_UNKNOWN,
                        );
                    },
                    classArgNumber: (node, compiler, imports) => {
                        const name = node.NAME
                            ? compiler.descendInput(node.NAME).asString()
                            : "";
                        const defaultValue = node.DEFAULT
                            ? compiler.descendInput(node.DEFAULT).asUnknown()
                            : "undefined";
                        const key = JSON.stringify(name);
                        return new imports.TypedInput(
                            `(function(){ const argObj = { [${key}]: ${defaultValue} }; return vm.runtime.ext_jsoop._storeClassArgDefault(argObj); })()`,
                            imports.TYPE_UNKNOWN,
                        );
                    },
                    classArgDogeiscutObject: (node, compiler, imports) => {
                        const name = node.NAME
                            ? compiler.descendInput(node.NAME).asString()
                            : "";
                        const defaultValue = node.DEFAULT
                            ? compiler.descendInput(node.DEFAULT).asUnknown()
                            : "undefined";
                        const key = JSON.stringify(name);
                        return new imports.TypedInput(
                            `(function(){ const argObj = { [${key}]: ${defaultValue} }; return vm.runtime.ext_jsoop._storeClassArgDefault(argObj); })()`,
                            imports.TYPE_UNKNOWN,
                        );
                    },
                    classArgJwArray: (node, compiler, imports) => {
                        const name = node.NAME
                            ? compiler.descendInput(node.NAME).asString()
                            : "";
                        const defaultValue = node.DEFAULT
                            ? compiler.descendInput(node.DEFAULT).asUnknown()
                            : "undefined";
                        const key = JSON.stringify(name);
                        return new imports.TypedInput(
                            `(function(){ const argObj = { [${key}]: ${defaultValue} }; return vm.runtime.ext_jsoop._storeClassArgDefault(argObj); })()`,
                            imports.TYPE_UNKNOWN,
                        );
                    },
                    classArgJSObject: (node, compiler, imports) => {
                        const name = node.NAME
                            ? compiler.descendInput(node.NAME).asString()
                            : "";
                        const defaultValue = node.DEFAULT
                            ? compiler.descendInput(node.DEFAULT).asUnknown()
                            : "undefined";
                        const key = JSON.stringify(name);
                        return new imports.TypedInput(
                            `(function(){ const argObj = { [${key}]: ${defaultValue} }; return vm.runtime.ext_jsoop._storeClassArgDefault(argObj); })()`,
                            imports.TYPE_UNKNOWN,
                        );
                    },
                    classArgDefault: (node, compiler, imports) => {
                        const name = node.NAME
                            ? compiler.descendInput(node.NAME).asString()
                            : "";
                        const defaultValue = node.DEFAULT
                            ? compiler.descendInput(node.DEFAULT).asUnknown()
                            : "undefined";
                        const key = JSON.stringify(name);
                        return new imports.TypedInput(
                            `(function(){ const argObj = { [${key}]: ${defaultValue} }; return vm.runtime.ext_jsoop._storeClassArgDefault(argObj); })()`,
                            imports.TYPE_UNKNOWN,
                        );
                    },
                    classArgSpread: (node, compiler, imports) => {
                        const name = node.NAME
                            ? compiler.descendInput(node.NAME).asString()
                            : "";
                        const key = JSON.stringify(name);
                        return new imports.TypedInput(
                            `new vm.runtime.ext_jsoop.JSObject({ [${key}]: undefined })`,
                            imports.TYPE_UNKNOWN,
                        );
                    },
                    constantMath: (node, compiler, imports) =>
                        new imports.TypedInput(
                            "new vm.runtime.ext_jsoop.JSObject(Math)",
                            imports.TYPE_UNKNOWN,
                        ),
                    constantNull: (node, compiler, imports) =>
                        new imports.TypedInput(
                            "new vm.runtime.ext_jsoop.JSObject(null)",
                            imports.TYPE_UNKNOWN,
                        ),
                    constantUndefined: (node, compiler, imports) =>
                        new imports.TypedInput(
                            "new vm.runtime.ext_jsoop.JSObject(undefined)",
                            imports.TYPE_UNKNOWN,
                        ),
                    constantObject: (node, compiler, imports) =>
                        new imports.TypedInput(
                            "new vm.runtime.ext_jsoop.JSObject(Object)",
                            imports.TYPE_UNKNOWN,
                        ),
                    constantArray: (node, compiler, imports) =>
                        new imports.TypedInput(
                            "new vm.runtime.ext_jsoop.JSObject(Array)",
                            imports.TYPE_UNKNOWN,
                        ),
                    constantString: (node, compiler, imports) =>
                        new imports.TypedInput(
                            "new vm.runtime.ext_jsoop.JSObject(String)",
                            imports.TYPE_UNKNOWN,
                        ),
                    constantNumber: (node, compiler, imports) =>
                        new imports.TypedInput(
                            "new vm.runtime.ext_jsoop.JSObject(Number)",
                            imports.TYPE_UNKNOWN,
                        ),
                    constantBoolean: (node, compiler, imports) =>
                        new imports.TypedInput(
                            "new vm.runtime.ext_jsoop.JSObject(Boolean)",
                            imports.TYPE_UNKNOWN,
                        ),
                    constantFunction: (node, compiler, imports) =>
                        new imports.TypedInput(
                            "new vm.runtime.ext_jsoop.JSObject(Function)",
                            imports.TYPE_UNKNOWN,
                        ),
                    constantAsyncFunction: (node, compiler, imports) =>
                        new imports.TypedInput(
                            "new vm.runtime.ext_jsoop.JSObject(Object.getPrototypeOf(async function () {}).constructor)",
                            imports.TYPE_UNKNOWN,
                        ),
                    constantDate: (node, compiler, imports) =>
                        new imports.TypedInput(
                            "new vm.runtime.ext_jsoop.JSObject(Date)",
                            imports.TYPE_UNKNOWN,
                        ),
                    constantRegExp: (node, compiler, imports) =>
                        new imports.TypedInput(
                            "new vm.runtime.ext_jsoop.JSObject(RegExp)",
                            imports.TYPE_UNKNOWN,
                        ),
                    constantJSON: (node, compiler, imports) =>
                        new imports.TypedInput(
                            "new vm.runtime.ext_jsoop.JSObject(JSON)",
                            imports.TYPE_UNKNOWN,
                        ),
                    constantPromise: (node, compiler, imports) =>
                        new imports.TypedInput(
                            "new vm.runtime.ext_jsoop.JSObject(Promise)",
                            imports.TYPE_UNKNOWN,
                        ),
                    constantError: (node, compiler, imports) =>
                        new imports.TypedInput(
                            "new vm.runtime.ext_jsoop.JSObject(Error)",
                            imports.TYPE_UNKNOWN,
                        ),
                    constantMap: (node, compiler, imports) =>
                        new imports.TypedInput(
                            "new vm.runtime.ext_jsoop.JSObject(Map)",
                            imports.TYPE_UNKNOWN,
                        ),
                    constantSet: (node, compiler, imports) =>
                        new imports.TypedInput(
                            "new vm.runtime.ext_jsoop.JSObject(Set)",
                            imports.TYPE_UNKNOWN,
                        ),
                    constantWeakMap: (node, compiler, imports) =>
                        new imports.TypedInput(
                            "new vm.runtime.ext_jsoop.JSObject(WeakMap)",
                            imports.TYPE_UNKNOWN,
                        ),
                    constantWeakSet: (node, compiler, imports) =>
                        new imports.TypedInput(
                            "new vm.runtime.ext_jsoop.JSObject(WeakSet)",
                            imports.TYPE_UNKNOWN,
                        ),
                    constantSymbol: (node, compiler, imports) =>
                        new imports.TypedInput(
                            "new vm.runtime.ext_jsoop.JSObject(Symbol)",
                            imports.TYPE_UNKNOWN,
                        ),
                    constantProxy: (node, compiler, imports) =>
                        new imports.TypedInput(
                            "new vm.runtime.ext_jsoop.JSObject(Proxy)",
                            imports.TYPE_UNKNOWN,
                        ),
                    constantReflect: (node, compiler, imports) =>
                        new imports.TypedInput(
                            "new vm.runtime.ext_jsoop.JSObject(Reflect)",
                            imports.TYPE_UNKNOWN,
                        ),
                    constantIntl: (node, compiler, imports) =>
                        new imports.TypedInput(
                            "new vm.runtime.ext_jsoop.JSObject(Intl)",
                            imports.TYPE_UNKNOWN,
                        ),
                    constantConsole: (node, compiler, imports) =>
                        new imports.TypedInput(
                            "new vm.runtime.ext_jsoop.JSObject(console)",
                            imports.TYPE_UNKNOWN,
                        ),
                    constantGlobalThis: (node, compiler, imports) =>
                        new imports.TypedInput(
                            "new vm.runtime.ext_jsoop.JSObject(globalThis)",
                            imports.TYPE_UNKNOWN,
                        ),
                    constantInfinity: (node, compiler, imports) =>
                        new imports.TypedInput(
                            "new vm.runtime.ext_jsoop.JSObject(Infinity)",
                            imports.TYPE_UNKNOWN,
                        ),
                    constantNaN: (node, compiler, imports) =>
                        new imports.TypedInput(
                            "new vm.runtime.ext_jsoop.JSObject(NaN)",
                            imports.TYPE_UNKNOWN,
                        ),
                    callMethod: (node, compiler, imports) => {
                        const methodExpr = compiler
                            .descendInput(node.METHOD)
                            .asString();
                        const instanceExpr = compiler
                            .descendInput(node.INSTANCE)
                            .asUnknown();
                        const argsExpr = node.ARGS
                            ? compiler.descendInput(node.ARGS).asUnknown()
                            : "new vm.jwArray.Type([])";

                        const source = `(yield* (function*() {
     const method = ${methodExpr};
     const instance = ${instanceExpr};
     const target = instance instanceof vm.runtime.ext_jsoop.JSObject ? instance.value : instance;
     const proto = target !== null && target !== undefined ? Object.getPrototypeOf(target) : null;
     const fn = (target && target[method]) || (proto && proto[method]);
     const actualFn = fn instanceof vm.runtime.ext_jsoop.JSObject ? fn.value : fn;
     if (!actualFn || typeof actualFn !== 'function') return new vm.runtime.ext_jsoop.JSObject(undefined);
     let args = (${argsExpr});
     if (args instanceof vm.runtime.ext_jsoop.JSObject) args = args.value;
     if (args instanceof vm.jwArray.Type) args = args.array;
     if (!args) args = [];
     if (!Array.isArray(args)) args = [args];
     if (actualFn && actualFn._jsoopFactory) {
       const clonedThread = typeof thread !== 'undefined' && thread && typeof thread.clone === 'function' ? thread.clone() : thread;
       if (clonedThread) clonedThread.jsoopArgs = {};
       const paramNames = Array.isArray(actualFn._jsoopParams) ? actualFn._jsoopParams : [];
       for (let i = 0; i < paramNames.length; i++) {
         clonedThread.jsoopArgs[String(paramNames[i] || i)] = args[i];
       }
       return yield* waitPromise(vm.runtime.ext_jsoop._invokeJsoopFactory(actualFn, target, clonedThread, args));
     }
     const result = actualFn.apply(target, actualFn && actualFn._jsoopMethod ? [thread].concat(args) : args);
     if (result && typeof result.next === 'function') return yield* result;
     return new vm.runtime.ext_jsoop.JSObject(result);
   })())`;
                        return new imports.TypedInput(
                            source,
                            imports.TYPE_UNKNOWN,
                        );
                    },
                    runMethod: (node, compiler, imports) => {
                        const methodExpr = compiler
                            .descendInput(node.METHOD)
                            .asString();
                        const instanceExpr = compiler
                            .descendInput(node.INSTANCE)
                            .asUnknown();
                        const argsExpr = node.ARGS
                            ? compiler.descendInput(node.ARGS).asUnknown()
                            : "new vm.jwArray.Type([])";

                        compiler.source += `yield* (function*() {
     const method = ${methodExpr};
     const instance = ${instanceExpr};
     const target = instance instanceof vm.runtime.ext_jsoop.JSObject ? instance.value : instance;
     const proto = target !== null && target !== undefined ? Object.getPrototypeOf(target) : null;
     const fn = (target && target[method]) || (proto && proto[method]);
     const actualFn = fn instanceof vm.runtime.ext_jsoop.JSObject ? fn.value : fn;
     if (!actualFn || typeof actualFn !== 'function') return;
     let args = (${argsExpr});
     if (args instanceof vm.runtime.ext_jsoop.JSObject) args = args.value;
     if (args instanceof vm.jwArray.Type) args = args.array;
     if (!args) args = [];
     if (!Array.isArray(args)) args = [args];
     if (actualFn && actualFn._jsoopFactory) {
       const clonedThread = typeof thread !== 'undefined' && thread && typeof thread.clone === 'function' ? thread.clone() : thread;
       if (clonedThread) clonedThread.jsoopArgs = {};
       const paramNames = Array.isArray(actualFn._jsoopParams) ? actualFn._jsoopParams : [];
       for (let i = 0; i < paramNames.length; i++) {
         clonedThread.jsoopArgs[String(paramNames[i] || i)] = args[i];
       }
       yield* waitPromise(vm.runtime.ext_jsoop._invokeJsoopFactory(actualFn, target, clonedThread, args));
       return;
     }
     const result = actualFn.apply(target, actualFn && actualFn._jsoopMethod ? [thread].concat(args) : args);
     if (result && typeof result.next === 'function') {
       yield* result;
       return;
     }
     if (result && typeof result.then === 'function') {
       yield* waitPromise(result);
       return;
     }
   })();`;
                    },
                    callFunction: (node, compiler, imports) => {
                        const funcExpr = compiler
                            .descendInput(node.FUNC)
                            .asUnknown();
                        const thisExpr = compiler
                            .descendInput(node.THIS)
                            .asUnknown();
                        const argsExpr = node.ARGS
                            ? compiler.descendInput(node.ARGS).asUnknown()
                            : "new vm.jwArray.Type([])";

                        const source = `(yield* (function*() {
     const func = ${funcExpr};
     const thisArg = ${thisExpr};
     const target = thisArg instanceof vm.runtime.ext_jsoop.JSObject ? thisArg.value : thisArg;
     const actualFunc = func instanceof vm.runtime.ext_jsoop.JSObject ? func.value : func;
     if (!actualFunc || typeof actualFunc !== 'function') return new vm.runtime.ext_jsoop.JSObject(undefined);
     let args = (${argsExpr});
     if (args instanceof vm.runtime.ext_jsoop.JSObject) args = args.value;
     if (args instanceof vm.jwArray.Type) args = args.array;
     if (!args) args = [];
     if (!Array.isArray(args)) args = [args];
     if (actualFunc && actualFunc._jsoopFactory) {
       const clonedThread = typeof thread !== 'undefined' && thread && typeof thread.clone === 'function' ? thread.clone() : thread;
       if (clonedThread) clonedThread.jsoopArgs = {};
       const paramNames = Array.isArray(actualFunc._jsoopParams) ? actualFunc._jsoopParams : [];
       for (let i = 0; i < paramNames.length; i++) {
         clonedThread.jsoopArgs[String(paramNames[i] || i)] = args[i];
       }
       return yield* waitPromise(vm.runtime.ext_jsoop._invokeJsoopFactory(actualFunc, target, clonedThread, args));
     }
     const result = actualFunc.apply(target, actualFunc && actualFunc._jsoopMethod ? [thread].concat(args) : args);
     if (result && typeof result.next === 'function') return yield* result;
     return new vm.runtime.ext_jsoop.JSObject(result);
   })())`;
                        return new imports.TypedInput(
                            source,
                            imports.TYPE_UNKNOWN,
                        );
                    },
                    runFunction: (node, compiler, imports) => {
                        const funcExpr = compiler
                            .descendInput(node.FUNC)
                            .asUnknown();
                        const thisExpr = compiler
                            .descendInput(node.THIS)
                            .asUnknown();
                        const argsExpr = node.ARGS
                            ? compiler.descendInput(node.ARGS).asUnknown()
                            : "new vm.jwArray.Type([])";

                        compiler.source += `yield* (function*() {
     const func = ${funcExpr};
     const thisArg = ${thisExpr};
     const target = thisArg instanceof vm.runtime.ext_jsoop.JSObject ? thisArg.value : thisArg;
     const actualFunc = func instanceof vm.runtime.ext_jsoop.JSObject ? func.value : func;
     if (!actualFunc || typeof actualFunc !== 'function') return;
     let args = (${argsExpr});
     if (args instanceof vm.runtime.ext_jsoop.JSObject) args = args.value;
     if (args instanceof vm.jwArray.Type) args = args.array;
     if (!args) args = [];
     if (!Array.isArray(args)) args = [args];
     if (actualFunc && actualFunc._jsoopFactory) {
       const clonedThread = typeof thread !== 'undefined' && thread && typeof thread.clone === 'function' ? thread.clone() : thread;
       if (clonedThread) clonedThread.jsoopArgs = {};
       const paramNames = Array.isArray(actualFunc._jsoopParams) ? actualFunc._jsoopParams : [];
       for (let i = 0; i < paramNames.length; i++) {
         clonedThread.jsoopArgs[String(paramNames[i] || i)] = args[i];
       }
       yield* waitPromise(vm.runtime.ext_jsoop._invokeJsoopFactory(actualFunc, target, clonedThread, args));
       return;
     }
     const result = actualFunc.apply(target, actualFunc && actualFunc._jsoopMethod ? [thread].concat(args) : args);
     if (result && typeof result.next === 'function') {
       yield* result;
       return;
     }
     if (result && typeof result.then === 'function') {
       yield* waitPromise(result);
       return;
     }
   })();`;
                    },

                    awaitCallMethod: (node, compiler, imports) => {
                        const methodExpr = compiler
                            .descendInput(node.METHOD)
                            .asString();
                        const instanceExpr = compiler
                            .descendInput(node.INSTANCE)
                            .asUnknown();
                        const argsExpr = node.ARGS
                            ? compiler.descendInput(node.ARGS).asUnknown()
                            : "new vm.jwArray.Type([])";

                        const source = `(yield* (function*() {
     const method = ${methodExpr};
     const instance = ${instanceExpr};
     const target = instance instanceof vm.runtime.ext_jsoop.JSObject ? instance.value : instance;
     const methodTarget = __target;
     const proto = target !== null && target !== undefined ? Object.getPrototypeOf(target) : null;
     const fn = (target && target[method]) || (proto && proto[method]);
     const actualFn = fn instanceof vm.runtime.ext_jsoop.JSObject ? fn.value : fn;
     if (!actualFn || typeof actualFn !== 'function') return new vm.runtime.ext_jsoop.JSObject(undefined);

     let args = (${argsExpr});
     if (args instanceof vm.runtime.ext_jsoop.JSObject) args = args.value;
     if (args instanceof vm.jwArray.Type) args = args.array;
     if (!args) args = [];
     if (!Array.isArray(args)) args = [args];

     if (actualFn && actualFn._jsoopFactory) {
       const clonedThread = typeof thread !== 'undefined' && thread && typeof thread.clone === 'function' ? thread.clone() : thread;
       if (!clonedThread) return new vm.runtime.ext_jsoop.JSObject(undefined);

       clonedThread.jsoopArgs = {};
       clonedThread._jsoopCallerTarget = target;
       clonedThread._jsoopMethodTarget = methodTarget;

       const paramNames = Array.isArray(actualFn._jsoopParams) ? actualFn._jsoopParams : [];
       for (let i = 0; i < paramNames.length; i++) {
         clonedThread.jsoopArgs[String(paramNames[i] || i)] = args[i];
       }

       actualFn._jsoopOwnerTarget = methodTarget;

       const result = yield* waitPromise(
         vm.runtime.ext_jsoop._invokeJsoopFactory(actualFn, target, clonedThread, args)
       );
       return new vm.runtime.ext_jsoop.JSObject(result);
     }

     const result = actualFn.apply(target, actualFn && actualFn._jsoopMethod ? [thread].concat(args) : args);
     if (result && typeof result.next === 'function') return new vm.runtime.ext_jsoop.JSObject(yield* result);
     if (result && typeof result.then === 'function') {
       return new vm.runtime.ext_jsoop.JSObject(yield* waitPromise(result));
     }
     return new vm.runtime.ext_jsoop.JSObject(result);
   })())`;

                        return new imports.TypedInput(
                            source,
                            imports.TYPE_UNKNOWN,
                        );
                    },

                    awaitRunMethod: (node, compiler, imports) => {
                        const methodExpr = compiler
                            .descendInput(node.METHOD)
                            .asString();
                        const instanceExpr = compiler
                            .descendInput(node.INSTANCE)
                            .asUnknown();
                        const argsExpr = node.ARGS
                            ? compiler.descendInput(node.ARGS).asUnknown()
                            : "new vm.jwArray.Type([])";

                        compiler.source += `yield* (function*() {
     const method = ${methodExpr};
     const instance = ${instanceExpr};
     const target = instance instanceof vm.runtime.ext_jsoop.JSObject ? instance.value : instance;
     const proto = target !== null && target !== undefined ? Object.getPrototypeOf(target) : null;
     const fn = (target && target[method]) || (proto && proto[method]);
     const actualFn = fn instanceof vm.runtime.ext_jsoop.JSObject ? fn.value : fn;
     if (!actualFn || typeof actualFn !== 'function') return;
     let args = (${argsExpr});
     if (args instanceof vm.runtime.ext_jsoop.JSObject) args = args.value;
     if (args instanceof vm.jwArray.Type) args = args.array;
     if (!args) args = [];
     if (!Array.isArray(args)) args = [args];
     console.log(thread);
     if (actualFn && actualFn._jsoopFactory) {
       const clonedThread = typeof thread !== 'undefined' && thread && typeof thread.clone === 'function' ? thread.clone() : thread;
       if (clonedThread) clonedThread.jsoopArgs = {};
       const paramNames = Array.isArray(actualFn._jsoopParams) ? actualFn._jsoopParams : [];
       for (let i = 0; i < paramNames.length; i++) {
         clonedThread.jsoopArgs[String(paramNames[i] || i)] = args[i];
       }
       yield* waitPromise(vm.runtime.ext_jsoop._invokeJsoopFactory(actualFn, target, clonedThread, args));
       return;
     }
     const result = actualFn.apply(target, actualFn && actualFn._jsoopMethod ? [thread].concat(args) : args);
     if (result && typeof result.next === 'function') yield* result;
     if (result && typeof result.then === 'function') {
       yield* waitPromise(result);
     }
   })();`;
                    },

                    awaitCallFunction: (node, compiler, imports) => {
                        const funcExpr = compiler
                            .descendInput(node.FUNC)
                            .asUnknown();
                        const thisExpr = compiler
                            .descendInput(node.THIS)
                            .asUnknown();
                        const argsExpr = node.ARGS
                            ? compiler.descendInput(node.ARGS).asUnknown()
                            : "new vm.jwArray.Type([])";

                        const source = `(yield* (function*() {
     const func = ${funcExpr};
     const thisArg = ${thisExpr};
     const target = thisArg instanceof vm.runtime.ext_jsoop.JSObject ? thisArg.value : thisArg;
     const actualFunc = func instanceof vm.runtime.ext_jsoop.JSObject ? func.value : func;
     if (!actualFunc || typeof actualFunc !== 'function') return new vm.runtime.ext_jsoop.JSObject(undefined);
     let args = (${argsExpr});
     if (args instanceof vm.runtime.ext_jsoop.JSObject) args = args.value;
     if (args instanceof vm.jwArray.Type) args = args.array;
     if (!args) args = [];
     if (!Array.isArray(args)) args = [args];
     if (actualFunc && actualFunc._jsoopFactory) {
       const clonedThread = typeof thread !== 'undefined' && thread && typeof thread.clone === 'function' ? thread.clone() : thread;
       if (clonedThread) clonedThread.jsoopArgs = {};
       const paramNames = Array.isArray(actualFunc._jsoopParams) ? actualFunc._jsoopParams : [];
       for (let i = 0; i < paramNames.length; i++) {
         clonedThread.jsoopArgs[String(paramNames[i] || i)] = args[i];
       }
       const result = yield* waitPromise(vm.runtime.ext_jsoop._invokeJsoopFactory(actualFunc, target, clonedThread, args));
       return new vm.runtime.ext_jsoop.JSObject(result);
     }
     const result = actualFunc.apply(target, actualFunc && actualFunc._jsoopMethod ? [thread].concat(args) : args);
     if (result && typeof result.next === 'function') return new vm.runtime.ext_jsoop.JSObject(yield* result);
     if (result && typeof result.then === 'function') {
       return new vm.runtime.ext_jsoop.JSObject(yield* waitPromise(result));
     }
     return new vm.runtime.ext_jsoop.JSObject(result);
   })())`;
                        return new imports.TypedInput(
                            source,
                            imports.TYPE_UNKNOWN,
                        );
                    },

                    awaitRunFunction: (node, compiler, imports) => {
                        const funcExpr = compiler
                            .descendInput(node.FUNC)
                            .asUnknown();
                        const thisExpr = compiler
                            .descendInput(node.THIS)
                            .asUnknown();
                        const argsExpr = node.ARGS
                            ? compiler.descendInput(node.ARGS).asUnknown()
                            : "new vm.jwArray.Type([])";

                        compiler.source += `yield* (function*() {
     const func = ${funcExpr};
     const thisArg = ${thisExpr};
     const target = thisArg instanceof vm.runtime.ext_jsoop.JSObject ? thisArg.value : thisArg;
     const actualFunc = func instanceof vm.runtime.ext_jsoop.JSObject ? func.value : func;
     if (!actualFunc || typeof actualFunc !== 'function') return;
     let args = (${argsExpr});
     if (args instanceof vm.runtime.ext_jsoop.JSObject) args = args.value;
     if (args instanceof vm.jwArray.Type) args = args.array;
     if (!args) args = [];
     if (!Array.isArray(args)) args = [args];
     if (actualFunc && actualFunc._jsoopFactory) {
       const clonedThread = typeof thread !== 'undefined' && thread && typeof thread.clone === 'function' ? thread.clone() : thread;
       if (clonedThread) clonedThread.jsoopArgs = {};
       const paramNames = Array.isArray(actualFunc._jsoopParams) ? actualFunc._jsoopParams : [];
       for (let i = 0; i < paramNames.length; i++) {
         clonedThread.jsoopArgs[String(paramNames[i] || i)] = args[i];
       }
       yield* waitPromise(vm.runtime.ext_jsoop._invokeJsoopFactory(actualFunc, target, clonedThread, args));
       return;
     }
     const result = actualFunc.apply(target, actualFunc && actualFunc._jsoopMethod ? [thread].concat(args) : args);
     if (result && typeof result.next === 'function') yield* result;
     if (result && typeof result.then === 'function') {
       yield* waitPromise(result);
     }
   })();`;
                    },
                },
            };
        }

        // Return blocks
        returnDataString(args, util) {
            util.thread.justReturned = Scratch.Cast.toString(args.DATA);
            util.thread.stopThisScript();
        }
        returnDataObject(args, util) {
            util.thread.justReturned = args.DATA;
            util.thread.stopThisScript();
        }
        returnDataArray(args, util) {
            util.thread.justReturned = args.DATA;
            util.thread.stopThisScript();
        }
        returnDataJsObject(args, util) {
            util.thread.justReturned = args.DATA;
            util.thread.stopThisScript();
        }

        // Arguments reporter
        argsReporter(_, util) {
            const args = util.thread.jsoopArgs || new JSObject(undefined);
            return this._wrapForOtherExtensions(args);
        }

        toNative(args) {
            return this._convertToNativeValue(args.VALUE);
        }

        _wrapMaybe(x) {
            if (x instanceof JSObject) return x;
            if (x && typeof x === "object" && x.customId)
                return new JSObject(x);
            return new JSObject(x);
        }

        _convertJwArrayToArgs(jwArrayObj) {
            if (jwArrayObj instanceof jwArray.Type) {
                return jwArrayObj.array.map((item) => {
                    // Resolve any JSObject references in the array
                    return this._convertToNativeValue(item);
                });
            }
            return [];
        }

        _convertResultToJwArray(result) {
            if (Array.isArray(result) && !(result instanceof jwArray.Type)) {
                return new jwArray.Type(result);
            }
            return result;
        }

        _convertToNativeValue(value) {
            return this._convertToNativeValueRecursive(value, new WeakSet());
        }

        _convertToNativeValueRecursive(value, seen) {
            // Resolve JSObject wrappers and lookup markers first
            if (value instanceof JSObject) value = value.value;

            if (
                value &&
                typeof value === "object" &&
                value._jsoopLookupMarker &&
                value.lookupId
            ) {
                const actual = this._getFromLookupTable(value.lookupId);
                if (actual instanceof JSObject) value = actual.value;
                else value = actual;
            }

            // Primitives, functions, null/undefined pass through
            if (value === null || value === undefined) return value;
            const t = typeof value;
            if (t !== "object") return value;

            // Avoid infinite recursion on circular references
            try {
                if (seen.has(value)) return value;
                seen.add(value);
            } catch (e) {
                // If value isn't weak-set-able, just return it
                return value;
            }

            // dogeiscutObject: value.map is expected to be entries for Object.fromEntries
            if (value && value.customId === "dogeiscutObject" && value.map) {
                try {
                    const obj = {};
                    for (const entry of value.map) {
                        if (!Array.isArray(entry) || entry.length < 2) continue;
                        const k = entry[0];
                        const v = entry[1];
                        obj[k] = this._convertToNativeValueRecursive(v, seen);
                    }
                    return obj;
                } catch (e) {
                    return Object.fromEntries(value.map);
                }
            }

            // jwArray: value.array
            if (value && value.customId === "jwArray" && value.array) {
                return value.array.map((item) =>
                    this._convertToNativeValueRecursive(item, seen),
                );
            }

            // Native Array: convert nested special values in place to preserve identity
            if (Array.isArray(value)) {
                for (let i = 0; i < value.length; i++) {
                    try {
                        value[i] = this._convertToNativeValueRecursive(
                            value[i],
                            seen,
                        );
                    } catch (e) {
                        // ignore
                    }
                }
                return value;
            }

            // Map: convert nested special values in place to preserve identity
            if (value instanceof Map) {
                for (const [k, v] of value.entries()) {
                    try {
                        value.set(
                            k,
                            this._convertToNativeValueRecursive(v, seen),
                        );
                    } catch (e) {
                        // ignore
                    }
                }
                return value;
            }

            // Plain object: convert nested special values in place
            try {
                for (const key of Object.keys(value)) {
                    try {
                        value[key] = this._convertToNativeValueRecursive(
                            value[key],
                            seen,
                        );
                    } catch (e) {
                        // ignore
                    }
                }
                return value;
            } catch (e) {
                return value;
            }
        }

        _convertToSafeString(value) {
            const nativeValue = this._convertToNativeValue(value);
            if (nativeValue instanceof JSObject) {
                return nativeValue.toString();
            }
            try {
                return String(nativeValue);
            } catch (e) {
                return "[unconvertible]";
            }
        }

        functionHatNotice() {
            alert(
                'Make sure to use the "await" version of the call method/function blocks when a function hat block returns a value, it returns a JavaScript Promise since the hat may not immediately return.',
            );
        }

        propSettingNotice() {
            alert(
                "These property settings block are to be used with JavaScript Objects stored in variables. They modify them in place!",
            );
        }

        codeInput(args) {
            return args.CODE;
        }

        constantMath() {
            // Math is now automatically stored in lookup table during initialization
            return this._wrapForOtherExtensions(new JSObject(Math));
        }

        constantNull() {
            return this._wrapForOtherExtensions(new JSObject(null));
        }

        constantUndefined() {
            return this._wrapForOtherExtensions(new JSObject(undefined));
        }

        constantObject() {
            return this._wrapForOtherExtensions(new JSObject(Object));
        }

        constantArray() {
            return this._wrapForOtherExtensions(new JSObject(Array));
        }

        constantString() {
            return this._wrapForOtherExtensions(new JSObject(String));
        }

        constantNumber() {
            return this._wrapForOtherExtensions(new JSObject(Number));
        }

        constantBoolean() {
            return this._wrapForOtherExtensions(new JSObject(Boolean));
        }

        constantFunction() {
            return this._wrapForOtherExtensions(new JSObject(Function));
        }

        constantAsyncFunction() {
            return this._wrapForOtherExtensions(
                new JSObject(
                    Object.getPrototypeOf(async function () {}).constructor,
                ),
            );
        }

        constantDate() {
            return this._wrapForOtherExtensions(new JSObject(Date));
        }

        constantRegExp() {
            return this._wrapForOtherExtensions(new JSObject(RegExp));
        }

        constantJSON() {
            return this._wrapForOtherExtensions(new JSObject(JSON));
        }

        constantPromise() {
            return this._wrapForOtherExtensions(new JSObject(Promise));
        }

        constantError() {
            return this._wrapForOtherExtensions(new JSObject(Error));
        }

        constantMap() {
            return this._wrapForOtherExtensions(new JSObject(Map));
        }

        constantSet() {
            return this._wrapForOtherExtensions(new JSObject(Set));
        }

        constantWeakMap() {
            return this._wrapForOtherExtensions(new JSObject(WeakMap));
        }

        constantWeakSet() {
            return this._wrapForOtherExtensions(new JSObject(WeakSet));
        }

        constantSymbol() {
            return this._wrapForOtherExtensions(new JSObject(Symbol));
        }

        constantProxy() {
            return this._wrapForOtherExtensions(new JSObject(Proxy));
        }

        constantReflect() {
            return this._wrapForOtherExtensions(new JSObject(Reflect));
        }

        constantIntl() {
            return this._wrapForOtherExtensions(new JSObject(Intl));
        }

        constantConsole() {
            return this._wrapForOtherExtensions(new JSObject(console));
        }

        constantGlobalThis() {
            return this._wrapForOtherExtensions(new JSObject(globalThis));
        }

        constantInfinity() {
            return this._wrapForOtherExtensions(new JSObject(Infinity));
        }

        constantNaN() {
            return this._wrapForOtherExtensions(new JSObject(NaN));
        }

        evalJS({ CODE }) {
            if (DEBUG)
                console.dir({
                    action: "evalJS(entry)",
                    CODE,
                });
            try {
                const fn = new Function(
                    '"use strict"; return (function(){ ' + CODE + " })()",
                );
                const result = fn();
                if (DEBUG)
                    console.dir({
                        action: "evalJS(resultRaw)",
                        result,
                    });
                const wrapped = JSObject.toType(result);
                if (DEBUG)
                    console.dir({
                        action: "evalJS(wrapped)",
                        wrapped,
                    });
                return this._wrapForOtherExtensions(wrapped);
            } catch (err) {
                console.error("JS OOP Error in evalJS:", err);
                if (DEBUG)
                    console.dir({
                        action: "evalJS(error)",
                        error: err,
                    });

                return this._wrapForOtherExtensions(
                    new JSObject({
                        error: String(err),
                    }),
                );
            }
        }

        runJS({ CODE }) {
            if (DEBUG)
                console.dir({
                    action: "runJS(entry)",
                    CODE,
                });
            try {
                const fn = new Function('"use strict"; ' + CODE);
                fn();
                if (DEBUG)
                    console.dir({
                        action: "runJS(done)",
                    });
            } catch (err) {
                console.error("JS OOP Error in runJS:", err);
                if (DEBUG)
                    console.dir({
                        action: "runJS(error)",
                        error: err,
                    });
            }
        }

        jsCommand({ CODE }) {
            return this.runJS({
                CODE,
            });
        }

        jsReporter({ CODE }) {
            return this.evalJS({
                CODE,
            });
        }

        new({ CONSTRUCTOR, ARGS }) {
            if (DEBUG)
                console.dir({
                    action: "new(entry)",
                    CONSTRUCTOR,
                    ARGS,
                });
            try {
                const ctorWrap = JSObject.toType(CONSTRUCTOR);
                const ctor = this._getActualValue(ctorWrap); // Resolve constructor reference
                const args = this._convertJwArrayToArgs(ARGS);
                if (typeof ctor !== "function") {
                    return this._wrapForOtherExtensions(
                        new JSObject({
                            error: "Constructor is not a function",
                        }),
                    );
                }
                try {
                    const instance = Reflect.construct(ctor, args);
                    if (DEBUG)
                        console.dir({
                            action: "new(result)",
                            instance,
                        });
                    const result = JSObject.toType(instance);
                    return this._wrapForOtherExtensions(
                        this._convertResultToJwArray(result),
                    );
                } catch (err) {
                    console.error("JS OOP Error in new:", err);
                    if (DEBUG)
                        console.dir({
                            action: "new(error)",
                            error: err,
                        });
                    return this._wrapForOtherExtensions(
                        new JSObject({
                            error: String(err),
                        }),
                    );
                }
            } catch (err) {
                console.error("JS OOP Error in new (outer):", err);
                if (DEBUG)
                    console.dir({
                        action: "new(errorOuter)",
                        error: err,
                    });
                return this._wrapForOtherExtensions(
                    new JSObject({
                        error: String(err),
                    }),
                );
            }
        }

        callMethod({ METHOD, INSTANCE, ARGS }, util) {
            if (DEBUG)
                console.dir({
                    action: "callMethod(entry)",
                    METHOD,
                    INSTANCE,
                    ARGS,
                });

            const target = this._getActualValue(
                this._convertToNativeValue(INSTANCE),
            ); // Resolve instance reference

            const args = this._convertJwArrayToArgs(ARGS);

            if (
                !target ||
                (typeof target !== "object" && typeof target !== "function")
            ) {
                const primProto = Object.getPrototypeOf(target);
                const fnPrim = primProto && primProto[METHOD];
                if (typeof fnPrim === "function") {
                    try {
                        const primIsFactory = this._isJsoopFactory(fnPrim);
                        const primCallArgs = primIsFactory
                            ? args
                            : fnPrim && fnPrim._jsoopMethod
                              ? [util && util.thread].concat(args)
                              : args;
                        const result = primIsFactory
                            ? this._invokeJsoopFactory(
                                  fnPrim,
                                  target,
                                  util && util.thread,
                                  args,
                              )
                            : fnPrim.apply(target, primCallArgs);
                        if (DEBUG)
                            console.dir({
                                action: "callMethod(resultPrimitive)",
                                result,
                            });
                        const wrappedResult = JSObject.toType(result);
                        return this._wrapForOtherExtensions(
                            this._convertResultToJwArray(wrappedResult),
                        );
                    } catch (err) {
                        console.error(
                            "JS OOP Error in callMethod (primitive):",
                            err,
                        );
                        if (DEBUG)
                            console.dir({
                                action: "callMethod(errorPrimitive)",
                                error: err,
                            });
                        return this._wrapForOtherExtensions(
                            new JSObject({
                                error: String(err),
                            }),
                        );
                    }
                }
                return this._wrapForOtherExtensions(
                    new JSObject({
                        error: `No method ${METHOD} on target`,
                    }),
                );
            }

            const fn = target[METHOD];
            if (typeof fn !== "function") {
                const proto = Object.getPrototypeOf(target);
                const fnProto = proto && proto[METHOD];
                if (typeof fnProto === "function") {
                    try {
                        const protoIsFactory = this._isJsoopFactory(fnProto);
                        const protoCallArgs = protoIsFactory
                            ? args
                            : fnProto && fnProto._jsoopMethod
                              ? [util && util.thread].concat(args)
                              : args;
                        const result = protoIsFactory
                            ? this._invokeJsoopFactory(
                                  fnProto,
                                  target,
                                  util && util.thread,
                                  args,
                              )
                            : fnProto.apply(target, protoCallArgs);
                        if (DEBUG)
                            console.dir({
                                action: "callMethod(resultProto)",
                                result,
                            });
                        const wrappedResult = JSObject.toType(result);
                        return this._wrapForOtherExtensions(
                            this._convertResultToJwArray(wrappedResult),
                        );
                    } catch (err) {
                        console.error(
                            "JS OOP Error in callMethod (proto):",
                            err,
                        );
                        if (DEBUG)
                            console.dir({
                                action: "callMethod(errorProto)",
                                error: err,
                            });
                        return this._wrapForOtherExtensions(
                            new JSObject({
                                error: String(err),
                            }),
                        );
                    }
                }

                return this._wrapForOtherExtensions(
                    new JSObject({
                        error: `No method ${METHOD}`,
                    }),
                );
            }

            try {
                const isFactory = this._isJsoopFactory(fn);
                const callArgs = isFactory
                    ? args
                    : fn && fn._jsoopMethod
                      ? [util && util.thread].concat(args)
                      : args;
                const result = isFactory
                    ? this._invokeJsoopFactory(
                          fn,
                          target,
                          util && util.thread,
                          args,
                      )
                    : fn.apply(target, callArgs);
                if (DEBUG)
                    console.dir({
                        action: "callMethod(result)",
                        result,
                    });
                return this._wrapForOtherExtensions(
                    this._convertResultToJwArray(
                        this._convertToNativeValue(result),
                    ),
                );
            } catch (err) {
                console.error("JS OOP Error in callMethod:", err);
                if (DEBUG)
                    console.dir({
                        action: "callMethod(error)",
                        error: err,
                    });
                return this._wrapForOtherExtensions(
                    new JSObject({
                        error: String(err),
                    }),
                );
            }
        }

        async awaitCallMethod({ METHOD, INSTANCE, ARGS }, util) {
            if (DEBUG)
                console.dir({
                    action: "awaitCallMethod(entry)",
                    METHOD,
                    INSTANCE,
                    ARGS,
                });

            const target = this._getActualValue(
                this._convertToNativeValue(INSTANCE),
            ); // Resolve instance reference
            const args = this._convertJwArrayToArgs(ARGS);

            if (
                !target ||
                (typeof target !== "object" && typeof target !== "function")
            ) {
                const primProto = Object.getPrototypeOf(target);
                const fnPrim = primProto && primProto[METHOD];
                if (typeof fnPrim === "function") {
                    try {
                        const primIsFactory = this._isJsoopFactory(fnPrim);
                        const primCallArgs = primIsFactory
                            ? args
                            : fnPrim && fnPrim._jsoopMethod
                              ? [util && util.thread].concat(args)
                              : args;
                        const res = primIsFactory
                            ? await this._invokeJsoopFactory(
                                  fnPrim,
                                  target,
                                  util && util.thread,
                                  args,
                              )
                            : fnPrim.apply(target, primCallArgs);
                        if (res && typeof res.then === "function") {
                            const awaited = await res;
                            if (DEBUG)
                                console.dir({
                                    action: "awaitCallMethod(resultPrimitiveAwaited)",
                                    awaited,
                                });
                            const wrappedResult = JSObject.toType(awaited);
                            return this._wrapForOtherExtensions(
                                this._convertResultToJwArray(wrappedResult),
                            );
                        }
                        if (DEBUG)
                            console.dir({
                                action: "awaitCallMethod(resultPrimitive)",
                                res,
                            });
                        const wrappedResult = JSObject.toType(res);
                        return this._wrapForOtherExtensions(
                            this._convertResultToJwArray(wrappedResult),
                        );
                    } catch (err) {
                        console.error(
                            "JS OOP Error in awaitCallMethod (primitive):",
                            err,
                        );
                        if (DEBUG)
                            console.dir({
                                action: "awaitCallMethod(errorPrimitive)",
                                error: err,
                            });
                        return this._wrapForOtherExtensions(
                            new JSObject({
                                error: String(err),
                            }),
                        );
                    }
                }
                return this._wrapForOtherExtensions(
                    new JSObject({
                        error: `No method ${METHOD} on target`,
                    }),
                );
            }

            let fn = target[METHOD];
            if (typeof fn !== "function") {
                const proto = Object.getPrototypeOf(target);
                fn = proto && proto[METHOD];
            }
            if (typeof fn !== "function") {
                return this._wrapForOtherExtensions(
                    new JSObject({
                        error: `No method ${METHOD}`,
                    }),
                );
            }

            try {
                const isFactory = this._isJsoopFactory(fn);
                const callArgs = isFactory
                    ? args
                    : fn && fn._jsoopMethod
                      ? [util && util.thread].concat(args)
                      : args;
                const result = isFactory
                    ? this._invokeJsoopFactory(
                          fn,
                          target,
                          util && util.thread,
                          args,
                      )
                    : fn.apply(target, callArgs);
                if (result && typeof result.then === "function") {
                    const awaited = await result;
                    if (DEBUG)
                        console.dir({
                            action: "awaitCallMethod(awaited)",
                            awaited,
                        });
                    const wrappedResult = JSObject.toType(awaited);
                    return this._wrapForOtherExtensions(
                        this._convertResultToJwArray(wrappedResult),
                    );
                }
                if (DEBUG)
                    console.dir({
                        action: "awaitCallMethod(result)",
                        result,
                    });
                return this._wrapForOtherExtensions(
                    this._convertResultToJwArray(
                        this._convertToNativeValue(result),
                    ),
                );
            } catch (err) {
                console.error("JS OOP Error in awaitCallMethod:", err);
                if (DEBUG)
                    console.dir({
                        action: "awaitCallMethod(error)",
                        error: err,
                    });
                return this._wrapForOtherExtensions(
                    new JSObject({
                        error: String(err),
                    }),
                );
            }
        }

        runMethod({ METHOD, INSTANCE, ARGS }, util) {
            if (DEBUG)
                console.dir({
                    action: "runMethod(entry)",
                    METHOD,
                    INSTANCE,
                    ARGS,
                });
            const target = this._getActualValue(
                this._convertToNativeValue(INSTANCE),
            ); // Resolve instance reference
            const args = this._convertJwArrayToArgs(ARGS);

            if (
                !target ||
                (typeof target !== "object" && typeof target !== "function")
            ) {
                const primProto = Object.getPrototypeOf(target);
                const fnPrim = primProto && primProto[METHOD];
                if (typeof fnPrim === "function") {
                    try {
                        const primIsFactory = this._isJsoopFactory(fnPrim);
                        const primCallArgs = primIsFactory
                            ? args
                            : fnPrim && fnPrim._jsoopMethod
                              ? [util && util.thread].concat(args)
                              : args;
                        const result = primIsFactory
                            ? this._invokeJsoopFactory(
                                  fnPrim,
                                  target,
                                  util && util.thread,
                                  args,
                              )
                            : fnPrim.apply(target, primCallArgs);
                        if (DEBUG)
                            console.dir({
                                action: "runMethod(donePrimitive)",
                            });
                        return;
                    } catch (err) {
                        console.error(
                            "JS OOP Error in runMethod (primitive):",
                            err,
                        );
                        if (DEBUG)
                            console.dir({
                                action: "runMethod(errorPrimitive)",
                                error: err,
                            });
                        return;
                    }
                }
                if (DEBUG)
                    console.dir({
                        action: "runMethod(noMethod)",
                    });
                return;
            }

            const fn =
                target[METHOD] ||
                (Object.getPrototypeOf(target) &&
                    Object.getPrototypeOf(target)[METHOD]);
            if (typeof fn === "function") {
                try {
                    const isFactory = this._isJsoopFactory(fn);
                    const callArgs = isFactory
                        ? args
                        : fn && fn._jsoopMethod
                          ? [util && util.thread].concat(args)
                          : args;
                    const result = isFactory
                        ? this._invokeJsoopFactory(
                              fn,
                              target,
                              util && util.thread,
                              args,
                          )
                        : fn.apply(target, callArgs);
                    if (DEBUG)
                        console.dir({
                            action: "runMethod(done",
                        });
                } catch (err) {
                    console.error("JS OOP Error in runMethod:", err);
                    if (DEBUG)
                        console.dir({
                            action: "runMethod(error)",
                            error: err,
                        });
                }
            } else {
                if (DEBUG)
                    console.dir({
                        action: "runMethod(noMethod)",
                        METHOD,
                    });
            }
        }

        callFunction({ FUNC, THIS, ARGS }, util) {
            if (DEBUG)
                console.dir({
                    action: "callFunction(entry)",
                    FUNC,
                    THIS,
                    ARGS,
                });

            try {
                const funcWrap = JSObject.toType(FUNC);
                const func = this._getActualValue(funcWrap); // Resolve function reference
                const thisArg = THIS
                    ? this._convertToNativeValue(THIS)
                    : undefined;
                const args = this._convertJwArrayToArgs(ARGS);

                if (typeof func !== "function") {
                    return this._wrapForOtherExtensions(
                        new JSObject({
                            error: "FUNC is not a function",
                        }),
                    );
                }

                const isFactory = this._isJsoopFactory(func);
                const callArgs = isFactory
                    ? args
                    : func && func._jsoopMethod
                      ? [util && util.thread].concat(args)
                      : args;
                const result = isFactory
                    ? this._invokeJsoopFactory(
                          func,
                          thisArg,
                          util && util.thread,
                          args,
                      )
                    : func.apply(thisArg, callArgs);
                if (DEBUG)
                    console.dir({
                        action: "callFunction(result)",
                        result,
                    });

                return this._wrapForOtherExtensions(
                    this._convertResultToJwArray(
                        this._convertToNativeValue(result),
                    ),
                );
            } catch (err) {
                console.error("JS OOP Error in callFunction:", err);
                if (DEBUG)
                    console.dir({
                        action: "callFunction(error)",
                        error: err,
                    });
                return this._wrapForOtherExtensions(
                    new JSObject({
                        error: String(err),
                    }),
                );
            }
        }

        async awaitCallFunction({ FUNC, THIS, ARGS }, util) {
            if (DEBUG)
                console.dir({
                    action: "awaitCallFunction(entry)",
                    FUNC,
                    THIS,
                    ARGS,
                });

            try {
                const funcWrap = JSObject.toType(FUNC);
                const func = this._getActualValue(funcWrap); // Resolve function reference
                const thisArg = THIS
                    ? this._convertToNativeValue(THIS)
                    : undefined;
                const args = this._convertJwArrayToArgs(ARGS);

                if (typeof func !== "function") {
                    return this._wrapForOtherExtensions(
                        new JSObject({
                            error: "FUNC is not a function",
                        }),
                    );
                }

                const isFactory = this._isJsoopFactory(func);
                let result = isFactory
                    ? await this._invokeJsoopFactory(
                          func,
                          thisArg,
                          util && util.thread,
                          args,
                      )
                    : func.apply(
                          thisArg,
                          func && func._jsoopMethod
                              ? [util && util.thread].concat(args)
                              : args,
                      );
                if (result && typeof result.then === "function") {
                    result = await result;
                }

                if (DEBUG)
                    console.dir({
                        action: "awaitCallFunction(result)",
                        result,
                    });

                //const wrappedResult = JSObject.toType(result);
                return this._wrapForOtherExtensions(
                    this._convertResultToJwArray(
                        this._convertToNativeValue(result),
                    ),
                );
            } catch (err) {
                console.error("JS OOP Error in awaitCallFunction:", err);
                if (DEBUG)
                    console.dir({
                        action: "awaitCallFunction(error)",
                        error: err,
                    });
                return this._wrapForOtherExtensions(
                    new JSObject({
                        error: String(err),
                    }),
                );
            }
        }

        runFunction({ FUNC, THIS, ARGS }, util) {
            if (DEBUG)
                console.dir({
                    action: "runFunction(entry)",
                    FUNC,
                    THIS,
                    ARGS,
                });

            try {
                const funcWrap = JSObject.toType(FUNC);
                const func = this._getActualValue(funcWrap); // Resolve function reference
                const thisArg = THIS
                    ? this._convertToNativeValue(THIS)
                    : undefined;
                const args = this._convertJwArrayToArgs(ARGS);

                if (typeof func !== "function") {
                    if (DEBUG)
                        console.dir({
                            action: "runFunction(notFunction)",
                        });
                    return;
                }

                const isFactory = this._isJsoopFactory(func);
                const callArgs = isFactory
                    ? args
                    : func && func._jsoopMethod
                      ? [util && util.thread].concat(args)
                      : args;
                const result = isFactory
                    ? this._invokeJsoopFactory(
                          func,
                          thisArg,
                          util && util.thread,
                          args,
                      )
                    : func.apply(thisArg, callArgs);
                if (DEBUG)
                    console.dir({
                        action: "runFunction(done)",
                    });
            } catch (err) {
                console.error("JS OOP Error in runFunction:", err);
                if (DEBUG)
                    console.dir({
                        action: "runFunction(error)",
                        error: err,
                    });
            }
        }

        async awaitRunFunction({ FUNC, THIS, ARGS }, util) {
            if (DEBUG)
                console.dir({
                    action: "awaitRunFunction(entry)",
                    FUNC,
                    THIS,
                    ARGS,
                });

            try {
                const funcWrap = JSObject.toType(FUNC);
                const func = this._getActualValue(funcWrap); // Resolve function reference
                const thisArg = THIS
                    ? this._convertToNativeValue(THIS)
                    : undefined;
                const args = this._convertJwArrayToArgs(ARGS);

                if (typeof func !== "function") {
                    if (DEBUG)
                        console.dir({
                            action: "awaitRunFunction(notFunction)",
                        });
                    return;
                }

                const isFactory = this._isJsoopFactory(func);
                let result = isFactory
                    ? await this._invokeJsoopFactory(
                          func,
                          thisArg,
                          util && util.thread,
                          args,
                      )
                    : func.apply(
                          thisArg,
                          func && func._jsoopMethod
                              ? [util && util.thread].concat(args)
                              : args,
                      );
                if (result && typeof result.then === "function") {
                    await result;
                }

                if (DEBUG)
                    console.dir({
                        action: "awaitRunFunction(done)",
                    });
            } catch (err) {
                console.error("JS OOP Error in awaitRunFunction:", err);
                if (DEBUG)
                    console.dir({
                        action: "awaitRunFunction(error)",
                        error: err,
                    });
            }
        }

        async awaitRunMethod({ METHOD, INSTANCE, ARGS }, util) {
            if (DEBUG)
                console.dir({
                    action: "awaitRunMethod(entry)",
                    METHOD,
                    INSTANCE,
                    ARGS,
                });

            const target = this._getActualValue(
                this._convertToNativeValue(INSTANCE),
            ); // Resolve instance reference
            const args = this._convertJwArrayToArgs(ARGS);

            if (
                !target ||
                (typeof target !== "object" && typeof target !== "function")
            ) {
                const primProto = Object.getPrototypeOf(target);
                const fnPrim = primProto && primProto[METHOD];
                if (typeof fnPrim === "function") {
                    try {
                        const primIsFactory = this._isJsoopFactory(fnPrim);
                        const primCallArgs = primIsFactory
                            ? args
                            : fnPrim && fnPrim._jsoopMethod
                              ? [util && util.thread].concat(args)
                              : args;
                        let result = primIsFactory
                            ? await this._invokeJsoopFactory(
                                  fnPrim,
                                  target,
                                  util && util.thread,
                                  args,
                              )
                            : fnPrim.apply(target, primCallArgs);
                        if (result && typeof result.then === "function") {
                            await result;
                        }
                        if (DEBUG)
                            console.dir({
                                action: "awaitRunMethod(donePrimitive)",
                            });
                        return;
                    } catch (err) {
                        console.error(
                            "JS OOP Error in awaitRunMethod (primitive):",
                            err,
                        );
                        if (DEBUG)
                            console.dir({
                                action: "awaitRunMethod(errorPrimitive)",
                                error: err,
                            });
                        return;
                    }
                }
                if (DEBUG)
                    console.dir({
                        action: "awaitRunMethod(noMethod)",
                    });
                return;
            }

            const fn =
                target[METHOD] ||
                (Object.getPrototypeOf(target) &&
                    Object.getPrototypeOf(target)[METHOD]);
            if (typeof fn === "function") {
                try {
                    const isFactory = this._isJsoopFactory(fn);
                    const callArgs = isFactory
                        ? args
                        : fn && fn._jsoopMethod
                          ? [util && util.thread].concat(args)
                          : args;
                    let result = isFactory
                        ? await this._invokeJsoopFactory(
                              fn,
                              target,
                              util && util.thread,
                              args,
                          )
                        : fn.apply(target, callArgs);
                    if (result && typeof result.then === "function") {
                        await result;
                    }
                    if (DEBUG)
                        console.dir({
                            action: "awaitRunMethod(done)",
                        });
                } catch (err) {
                    console.error("JS OOP Error in awaitRunMethod:", err);
                    if (DEBUG)
                        console.dir({
                            action: "awaitRunMethod(error)",
                            error: err,
                        });
                }
            } else {
                if (DEBUG)
                    console.dir({
                        action: "awaitRunMethod(noMethod)",
                        METHOD,
                    });
            }
        }

        getProp({ PROP, INSTANCE }) {
            if (DEBUG)
                console.dir({
                    action: "getProp(entry)",
                    PROP,
                    INSTANCE,
                });
            const target = this._getActualValue(INSTANCE); // Resolve instance reference (avoid cloning via to-native conversion)

            try {
                const val = target[PROP];
                if (DEBUG) console.dir({ action: "getProp(result)", val });

                // If the property is an object/function, return a lookup marker so
                // nested get/set calls refer to the same underlying object.
                if (
                    val !== null &&
                    val !== undefined &&
                    (typeof val === "object" || typeof val === "function")
                ) {
                    try {
                        const jsobj = new JSObject(val);
                        return this._storeInLookupTable(jsobj);
                    } catch (e) {
                        // Fallback to wrapper
                        return this._wrapForOtherExtensions(
                            JSObject.toType(val),
                        );
                    }
                }

                return this._getActualValue(this._convertToNativeValue(val));
            } catch (err) {
                console.error("JS OOP Error in getProp:", err);
                if (DEBUG)
                    console.dir({
                        action: "getProp(error)",
                        error: err,
                    });
                return `[Error: ${String(err)}]`;
            }
        }

        setPropString({ PROP, INSTANCE, VALUE }) {
            if (DEBUG)
                console.dir({
                    action: "setPropString(entry)",
                    PROP,
                    INSTANCE,
                    VALUE,
                });
            const resolved = this._resolveInstanceHolder(INSTANCE);
            const target = resolved.value; // underlying value to mutate

            let parsed;
            try {
                parsed = JSON.parse(VALUE);
            } catch {
                const t = VALUE && VALUE.trim();
                if (/^-?\d+(\.\d+)?$/.test(t)) parsed = Number(t);
                else if (t === "true") parsed = true;
                else if (t === "false") parsed = false;
                else parsed = VALUE;
            }

            try {
                if (
                    target &&
                    (typeof target === "object" || typeof target === "function")
                ) {
                    target[PROP] = parsed;
                } else {
                    const newObj = Object(target);
                    newObj[PROP] = parsed;
                    if (resolved.holder) resolved.holder.value = newObj;
                    else if (INSTANCE && typeof INSTANCE === "object")
                        INSTANCE.value = newObj;
                }
                if (DEBUG)
                    console.dir({
                        action: "setPropString(done)",
                        target: INSTANCE.value,
                    });
            } catch (err) {
                console.error("JS OOP Error in setPropString:", err);
                if (DEBUG)
                    console.dir({
                        action: "setPropString(error)",
                        error: err,
                    });
            }
        }

        setPropJSObject({ PROP, INSTANCE, VALUE }) {
            if (DEBUG)
                console.dir({
                    action: "setPropJSObject(entry)",
                    PROP,
                    INSTANCE,
                    VALUE,
                });
            const resolved = this._resolveInstanceHolder(INSTANCE);
            const target = resolved.value;
            const value =
                VALUE instanceof JSObject ||
                (VALUE &&
                    typeof VALUE === "object" &&
                    (VALUE._jsoopLookupMarker || VALUE.customId))
                    ? VALUE
                    : this._convertToNativeValue(VALUE);

            try {
                if (
                    target &&
                    (typeof target === "object" || typeof target === "function")
                ) {
                    target[PROP] = value;
                } else {
                    const newObj = Object(target);
                    newObj[PROP] = value;
                    if (resolved.holder) resolved.holder.value = newObj;
                    else if (INSTANCE && typeof INSTANCE === "object")
                        INSTANCE.value = newObj;
                }
                if (DEBUG)
                    console.dir({
                        action: "setPropJSObject(done)",
                        target: resolved.holder
                            ? resolved.holder.value
                            : target,
                    });
            } catch (err) {
                console.error("JS OOP Error in setPropJSObject:", err);
                if (DEBUG)
                    console.dir({
                        action: "setPropJSObject(error)",
                        error: err,
                    });
            }
        }

        setPropJwArray({ PROP, INSTANCE, VALUE }) {
            if (DEBUG)
                console.dir({
                    action: "setPropJwArray(entry)",
                    PROP,
                    INSTANCE,
                    VALUE,
                });
            const resolved = this._resolveInstanceHolder(INSTANCE);
            const holder = resolved.holder;
            const target = resolved.value;
            const value =
                VALUE instanceof JSObject ||
                (VALUE &&
                    typeof VALUE === "object" &&
                    (VALUE._jsoopLookupMarker || VALUE.customId))
                    ? VALUE
                    : this._convertToNativeValue(VALUE);

            try {
                // If this is a jwArray wrapper (the original object), write to its .array
                if (target && target instanceof jwArray.Type) {
                    target.array[PROP] = value;
                } else if (
                    INSTANCE &&
                    INSTANCE.customId === "jwArray" &&
                    INSTANCE.array
                ) {
                    // fallback in case wrapper was passed differently
                    INSTANCE.array[PROP] = value;
                } else if (
                    target &&
                    (typeof target === "object" || typeof target === "function")
                ) {
                    target[PROP] = value;
                } else {
                    const newObj = Object(target);
                    newObj[PROP] = value;
                    if (holder) holder.value = newObj;
                    else if (INSTANCE && typeof INSTANCE === "object")
                        INSTANCE.value = newObj;
                }
                if (DEBUG)
                    console.dir({
                        action: "setPropJwArray(done)",
                        target: holder ? holder.value : target,
                    });
            } catch (err) {
                console.error("JS OOP Error in setPropJwArray:", err);
                if (DEBUG)
                    console.dir({
                        action: "setPropJwArray(error)",
                        error: err,
                    });
            }
        }

        setPropDogeiscutObject({ PROP, INSTANCE, VALUE }) {
            if (DEBUG)
                console.dir({
                    action: "setPropDogeiscutObject(entry)",
                    PROP,
                    INSTANCE,
                    VALUE,
                });
            const resolved = this._resolveInstanceHolder(INSTANCE);
            const holder = resolved.holder;
            const target = resolved.value;
            const value =
                VALUE instanceof JSObject ||
                (VALUE &&
                    typeof VALUE === "object" &&
                    (VALUE._jsoopLookupMarker || VALUE.customId))
                    ? VALUE
                    : this._convertToNativeValue(VALUE);

            try {
                // If this is a dogeiscutObject wrapper (has map), update its map entries
                if (
                    target &&
                    target.customId === "dogeiscutObject" &&
                    Array.isArray(target.map)
                ) {
                    // find existing key
                    let found = false;
                    for (let i = 0; i < target.map.length; i++) {
                        if (target.map[i][0] === PROP) {
                            target.map[i][1] = value;
                            found = true;
                            break;
                        }
                    }
                    if (!found) target.map.push([PROP, value]);
                } else if (
                    INSTANCE &&
                    INSTANCE.customId === "dogeiscutObject" &&
                    Array.isArray(INSTANCE.map)
                ) {
                    let found = false;
                    for (let i = 0; i < INSTANCE.map.length; i++) {
                        if (INSTANCE.map[i][0] === PROP) {
                            INSTANCE.map[i][1] = value;
                            found = true;
                            break;
                        }
                    }
                    if (!found) INSTANCE.map.push([PROP, value]);
                } else if (
                    target &&
                    (typeof target === "object" || typeof target === "function")
                ) {
                    target[PROP] = value;
                } else {
                    const newObj = Object(target);
                    newObj[PROP] = value;
                    if (holder) holder.value = newObj;
                    else if (INSTANCE && typeof INSTANCE === "object")
                        INSTANCE.value = newObj;
                }
                if (DEBUG)
                    console.dir({
                        action: "setPropDogeiscutObject(done)",
                        target: holder ? holder.value : target,
                    });
            } catch (err) {
                console.error("JS OOP Error in setPropDogeiscutObject:", err);
                if (DEBUG)
                    console.dir({
                        action: "setPropDogeiscutObject(error)",
                        error: err,
                    });
            }
        }

        stringify({ VALUE }) {
            try {
                let inner = VALUE;

                if (
                    VALUE &&
                    typeof VALUE === "object" &&
                    VALUE.customId === "jsObject"
                ) {
                    inner = VALUE.value;
                } else if (VALUE instanceof JSObject) {
                    inner = VALUE.value;
                } else {
                    try {
                        inner = JSON.parse(VALUE);
                    } catch {}
                }
                try {
                    return safeSerialize(inner);
                } catch (e) {
                    if (typeof inner === "function") return inner.toString();
                    return String(inner);
                }
            } catch (err) {
                console.error("JS OOP Error in stringify:", err);
                if (DEBUG)
                    console.dir({
                        action: "stringify(error)",
                        error: err,
                    });
                return String(VALUE);
            }
        }

        typeName({ INSTANCE }) {
            const v = this._getActualValue(
                this._convertToNativeValue(INSTANCE),
            ); // Resolve instance reference
            if (v === null) return "null";
            if (v === undefined) return "undefined";
            if (typeof v === "function")
                return `function ${v.name || "(anonymous)"}`;
            if (typeof v === "object")
                return v.constructor && v.constructor.name
                    ? v.constructor.name
                    : "Object";
            return typeof v;
        }
    }

    Scratch.extensions.register(new JSOOPExtension());
})(Scratch);
