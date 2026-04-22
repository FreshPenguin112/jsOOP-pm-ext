/* jshint esversion:11 */

(async function (Scratch) {
    "use strict";

    if (!Scratch.extensions || !Scratch.extensions.unsandboxed) {
        throw new Error("'JS OOP' extension must run unsandboxed!");
    }

    const vm = Scratch.vm;

    let DEBUG = !false;

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
                    if (v >= minSafe && v <= maxSafe) return Number(v);
                    else return v.toString();
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
                if (t === "function")
                    return v.name ? `[Function ${v.name}]` : "[Function]";
                if (t === "object") {
                    try {
                        if (DEBUG) console.dir({ safe: safeSerialize(v) });
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
            if (
                x &&
                typeof x === "object" &&
                x._jsoopLookupMarker &&
                x.lookupId
            ) {
                const ext = vm.runtime.ext_jsoop;
                if (ext) {
                    const actualObject = ext._getFromLookupTable(x.lookupId);
                    if (actualObject) return actualObject;
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
                    )
                        return new JSObject(x);
                } catch (_) {}
                return new JSObject(x);
            }
            return new JSObject(x);
        }
        static prepareForSerialize(v) {
            const ext = vm.runtime.ext_jsoop;
            if (ext && ext._shouldUseLookupTable(v)) {
                const marker = ext._storeInLookupTable(new JSObject(v));
                return { _jsoopLookupMarker: true, lookupId: marker.lookupId };
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
            if (typeof v === "function")
                return { _functionSource: v.toString() };
            try {
                const json = safeSerialize(v);
                return { _json: json };
            } catch (e) {
                return { _string: String(v) };
            }
        }
        static reconstructFromSerialize(obj) {
            try {
                if (obj && typeof obj === "object") {
                    if (obj._jsoopLookupMarker && obj.lookupId) {
                        const ext = vm.runtime.ext_jsoop;
                        if (ext) {
                            const actualObject = ext._getFromLookupTable(
                                obj.lookupId,
                            );
                            if (actualObject) return actualObject;
                        }
                        return new JSObject({
                            _jsoopLookupMissing: true,
                            originalLookupId: obj.lookupId,
                        });
                    }
                    if (
                        obj._nestedCustom &&
                        obj.typeId &&
                        vm.runtime.serializers[obj.typeId]
                    )
                        return vm.runtime.serializers[obj.typeId].deserialize(
                            obj.data,
                        );
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
                    if (obj._string) return obj._string;
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
        ArgumentNonCheck: {
            shape: Scratch.BlockShape.BUMPED,
            exemptFromNormalization: true,
            //check: ["JSObject"],
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
            // User-configurable settings (defaults)
            this.settings = {
                automaticArgArrayToNativeConversion: true, // Automatic arg array -> native conversion
                automaticClassMethodCallArgsObjectToDogeiscutObject: true,
                // If true, when a compiled class/factory receives a spread arg ("...name")
                // the gathered remainder will be converted to a `jwArray.Type` inside
                // the generated `jsoopArgs` object. Default: true.
                automaticSpreadArgInClassArgsObjectToJwArrayConversion: true,
                preferCompiledClassArgStack: true, // Prefer compiled class-arg stack paths
                wrapNewInstances: true, // Whether to wrap `new` instances in JSObject
                enableDebugLogging: false, // Toggle verbose debug logging
                useLookupTableByDefault: true, // Whether lookup table is enabled by default
            };
            // Apply runtime-configurable defaults to internal flags
            this._lookupTableEnabled = !!this.settings.useLookupTableByDefault;
            DEBUG = !!this.settings.enableDebugLogging;
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
                return obj.value; // Return the value of the JSObject
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
                return value.value; // Return the value of the JSObject
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
            let methodProcedures = null;
            try {
                const C = class {};

                // Helper: convert a stringified function into a real function if possible.
                // Prefer the VM's `scopedEval` when available (returns a function),
                // otherwise fall back to the existing `new Function` fallbacks.
                const stringToFunction = (src) => {
                    if (typeof src === "function") return src;
                    if (typeof src !== "string") return null;
                    let code = src;
                    try {
                        if (
                            (code.startsWith('"') && code.endsWith('"')) ||
                            (code.startsWith("'") && code.endsWith("'"))
                        ) {
                            code = JSON.parse(code);
                        }
                    } catch (_) {}

                    // Try VM scopedEval first if available
                    try {
                        if (
                            vm &&
                            vm.exports &&
                            vm.exports.jsexecute &&
                            typeof vm.exports.jsexecute.scopedEval ===
                                "function"
                        ) {
                            try {
                                const f = vm.exports.jsexecute.scopedEval(code);
                                f._isProcedure = true; // Mark as procedure for later identification
                                if (typeof f === "function") return f;
                            } catch (err) {
                                try {
                                    const f2 = vm.exports.jsexecute.scopedEval(
                                        "(" + code + ")",
                                    );
                                    f2._isProcedure = true; // Mark as procedure for later identification
                                    if (typeof f2 === "function") return f2;
                                } catch (_) {}
                            }
                        }
                    } catch (_) {}

                    // Fallback to new Function
                    try {
                        return new Function("return " + code)();
                    } catch (e) {
                        try {
                            return new Function("return (" + code + ")")();
                        } catch (e2) {
                            try {
                                const wrapper = `(function() { return (${code}); })`;
                                return new Function("return " + wrapper)()();
                            } catch (_) {
                                return null;
                            }
                        }
                    }
                };

                const convertProceduresInEnv = (names, values) => {
                    if (!Array.isArray(names) || !Array.isArray(values))
                        return values;
                    const idx = names.indexOf("procedures");
                    if (
                        idx >= 0 &&
                        values[idx] &&
                        typeof values[idx] === "object"
                    ) {
                        const srcObj = values[idx];
                        const out = {};
                        for (const k of Object.keys(srcObj)) {
                            const v = srcObj[k];
                            out[k] =
                                typeof v === "function"
                                    ? v
                                    : stringToFunction(v) || v;
                        }
                        const cloned = values.slice();
                        cloned[idx] = out;
                        return cloned;
                    }
                    return values;
                };

                let ctorFn = null;
                for (const m of methods || []) {
                    const name = String(m.name || "");
                    console.dir(m);
                    const params = m.params; //Array.isArray(m.params) ? m.params.map((p) => String(p)) : [];
                    const type = String(m.type || "");

                    const cleanName = name.startsWith("#")
                        ? name.slice(1)
                        : name;

                    let body = m.body || "";
                    if (typeof body !== "string") body = String(body);

                    let factorySrc = body;
                    try {
                        if (
                            (factorySrc.startsWith('"') &&
                                factorySrc.endsWith('"')) ||
                            (factorySrc.startsWith("'") &&
                                factorySrc.endsWith("'"))
                        ) {
                            factorySrc = JSON.parse(factorySrc);
                        }
                    } catch (_parseErr) {
                        // keep original if parse fails
                    }

                    let factoryFn = null;
                    try {
                        // Build a per-method environment list/values based on the
                        // provided global envNames/envValues plus any method-specific
                        // `procedures` object that may contain stringified functions.
                        const methodEnvNames = Array.isArray(envNames)
                            ? envNames.slice()
                            : [];
                        const methodEnvValues = Array.isArray(envValues)
                            ? envValues.slice()
                            : [];

                        // Accept `procedures` as an object (or JSON string) prepared
                        // by the compiler. Parse if needed, then convert any string
                        // values into real functions. Store converted object in
                        // `methodProcedures` so we can attach it to the resulting
                        // method as `_procedures`.

                        let procVal =
                            m && m.procedures != null ? m.procedures : null;
                        if (typeof procVal === "string") {
                            try {
                                procVal = JSON.parse(procVal);
                            } catch (e) {
                                // leave as-is; values will be converted below
                            }
                        }

                        if (procVal && typeof procVal === "object") {
                            methodProcedures = {};
                            for (const k of Object.keys(procVal)) {
                                const v = procVal[k];
                                methodProcedures[k] =
                                    typeof v === "function"
                                        ? v
                                        : stringToFunction(v) || v;
                            }
                            const procIdx =
                                methodEnvNames.indexOf("procedures");
                            if (procIdx === -1) {
                                methodEnvNames.push("procedures");
                                methodEnvValues.push(methodProcedures);
                            } else {
                                methodEnvValues[procIdx] = methodProcedures;
                            }
                        }

                        const hasEnv =
                            Array.isArray(methodEnvNames) &&
                            methodEnvNames.length > 0;
                        if (hasEnv) {
                            // If env contains procedures, convert any stringified functions there first.
                            const preparedEnvValues = convertProceduresInEnv(
                                methodEnvNames,
                                methodEnvValues,
                            );

                            const envList = methodEnvNames.map((n) =>
                                String(n),
                            );
                            const wrapperSrc = `(function(${envList.join(",")}){ return ${factorySrc}; })`;

                            // Try VM scopedEval on the wrapper first
                            if (
                                vm &&
                                vm.exports &&
                                vm.exports.jsexecute &&
                                typeof vm.exports.jsexecute.scopedEval ===
                                    "function"
                            ) {
                                try {
                                    const wrapperFn =
                                        vm.exports.jsexecute.scopedEval(
                                            wrapperSrc,
                                        );
                                    factoryFn = wrapperFn;
                                } catch (e) {
                                    try {
                                        const wrapperFn =
                                            vm.exports.jsexecute.scopedEval(
                                                "(" + wrapperSrc + ")",
                                            );
                                        factoryFn = wrapperFn;
                                    } catch (e2) {
                                        // fall back to new Function below
                                    }
                                }
                            }

                            if (!factoryFn) {
                                try {
                                    const wrapperFn = new Function(
                                        "return " + wrapperSrc,
                                    )();
                                    factoryFn =
                                        typeof wrapperFn === "function"
                                            ? wrapperFn.apply(
                                                  null,
                                                  preparedEnvValues,
                                              )
                                            : wrapperFn;
                                } catch (e) {
                                    try {
                                        factoryFn = new Function(
                                            "return (" + wrapperSrc + ")",
                                        )();
                                        if (typeof factoryFn === "function")
                                            factoryFn = factoryFn.apply(
                                                null,
                                                preparedEnvValues,
                                            );
                                    } catch (e2) {
                                        // fall through to later fallbacks
                                    }
                                }
                            }
                        }

                        // If env-based evaluation did not produce a function, try scopedEval
                        // (it returns a function when available) and then fall back to `new Function`.
                        if (!factoryFn) {
                            try {
                                if (
                                    vm &&
                                    vm.exports &&
                                    vm.exports.jsexecute &&
                                    typeof vm.exports.jsexecute.scopedEval ===
                                        "function"
                                ) {
                                    try {
                                        const maybe =
                                            vm.exports.jsexecute.scopedEval(
                                                factorySrc,
                                            );
                                        if (typeof maybe === "function") {
                                            factoryFn = maybe;
                                        }
                                    } catch (err) {
                                        try {
                                            const maybe2 =
                                                vm.exports.jsexecute.scopedEval(
                                                    "(" + factorySrc + ")",
                                                );
                                            if (typeof maybe2 === "function")
                                                factoryFn = maybe2;
                                        } catch (_) {}
                                    }
                                }
                            } catch (_) {}

                            if (!factoryFn) {
                                try {
                                    factoryFn = new Function(
                                        "return " + factorySrc,
                                    )();
                                } catch (e) {
                                    try {
                                        factoryFn = new Function(
                                            "return (" + factorySrc + ")",
                                        )();
                                    } catch (e2) {
                                        // leave factoryFn null for the wrapper fallback below
                                    }
                                }
                            }
                        }
                    } catch (e) {
                        // Last-resort fallback: try forcing an IIFE via new Function
                        try {
                            factoryFn = new Function(
                                "return (" + factorySrc + ")",
                            )();
                        } catch (e2) {
                            console.error(
                                "_makeClassFromMethods: failed to evaluate method factory for",
                                name,
                                e2,
                            );
                            factoryFn = null;
                        }
                    }

                    if (!factoryFn || typeof factoryFn !== "function") {
                        const wrapper = `(function() { return function(thread) { return (function*() { ${factorySrc} }); }; })`;
                        try {
                            try {
                                factoryFn = new Function("return " + wrapper)();
                            } catch (e) {
                                factoryFn = new Function(
                                    "return (" + wrapper + ")",
                                )();
                            }
                        } catch (e2) {
                            console.error(
                                "_makeClassFromMethods: wrapper eval also failed for",
                                name,
                                e2,
                            );
                            try {
                                const snippet = factorySrc
                                    ? String(factorySrc).slice(0, 200)
                                    : "<empty>";
                                console.error(
                                    "_makeClassFromMethods: failed factorySrc snippet:",
                                    snippet,
                                );
                            } catch (_) {}
                            factoryFn = null;
                        }
                    }

                    let fn = factoryFn;
                    if (typeof factoryFn === "function") {
                        try {
                            const maybe = factoryFn();
                            if (
                                typeof maybe === "function" ||
                                (maybe && typeof maybe.next === "function")
                            ) {
                                fn = maybe;
                            } else {
                                fn = factoryFn;
                            }
                        } catch (_callErr) {
                            fn = factoryFn;
                        }
                    }

                    // If the evaluated factory produced a string (due to double-quoting
                    // or other emitter quirks), try to recover a real function from it
                    // before attaching to the class prototype. This prevents methods on
                    // wrapped classes from ending up as plain strings.
                    if (typeof fn !== "function" && typeof fn === "string") {
                        let src = fn;
                        try {
                            if (
                                (src.startsWith('"') && src.endsWith('"')) ||
                                (src.startsWith("'") && src.endsWith("'"))
                            ) {
                                src = JSON.parse(src);
                            }
                        } catch (_) {}
                        try {
                            const recovered = stringToFunction(src);
                            if (typeof recovered === "function") {
                                fn = recovered;
                            } else {
                                try {
                                    const alt = new Function("return " + src)();
                                    if (typeof alt === "function") fn = alt;
                                } catch (_) {}
                            }
                        } catch (_) {}
                    }

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
                        // Attach converted procedures as a plain object on the method
                        // function so runtime code can access them directly.
                        try {
                            //console.log(methodProcedures);
                            Object.defineProperty(fn, "_procedures", {
                                value:
                                    typeof methodProcedures === "object" &&
                                    methodProcedures
                                        ? methodProcedures
                                        : {},
                                writable: false,
                                configurable: true,
                            });
                        } catch (_) {}
                    } catch (_) {
                        /* ignore */
                    }

                    if (
                        cleanName === "constructor" &&
                        !type.includes("static")
                    ) {
                        // Save constructor implementation for later: we'll create a
                        // wrapper class that invokes this method during `new`.
                        ctorFn = fn;
                        // Do not attach to prototype as a regular method.
                    } else if (type.includes("static")) {
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

                // After attaching methods, ensure no prototype methods are left as strings.
                try {
                    const protoKeys = Object.getOwnPropertyNames(C.prototype);
                    for (const key of protoKeys) {
                        if (key === "constructor") continue;
                        try {
                            const desc = Object.getOwnPropertyDescriptor(
                                C.prototype,
                                key,
                            );
                            if (!desc || typeof desc.value !== "string")
                                continue;
                            let src = desc.value;
                            try {
                                if (
                                    (src.startsWith('"') &&
                                        src.endsWith('"')) ||
                                    (src.startsWith("'") && src.endsWith("'"))
                                )
                                    src = JSON.parse(src);
                            } catch (_) {}
                            let conv = null;
                            try {
                                conv = stringToFunction(src);
                            } catch (_) {
                                conv = null;
                            }
                            if (typeof conv !== "function") {
                                try {
                                    conv = new Function("return " + src)();
                                } catch (_) {
                                    conv = null;
                                }
                            }
                            if (typeof conv === "function") {
                                Object.defineProperty(C.prototype, key, {
                                    value: conv,
                                    writable: true,
                                    configurable: true,
                                });
                            }
                        } catch (_) {}
                    }
                } catch (_) {}

                // If we captured a constructor method, create a subclass wrapper
                // whose constructor invokes the captured method implementation.
                if (ctorFn) {
                    try {
                        const Base = C;
                        const Wrapped = class extends Base {
                            constructor(...ctorArgs) {
                                super(...ctorArgs);
                                try {
                                    const callerThread =
                                        this &&
                                        this.constructor &&
                                        this.constructor._jsoopCallerThread
                                            ? this.constructor
                                                  ._jsoopCallerThread
                                            : typeof globalState !==
                                                    "undefined" &&
                                                globalState &&
                                                globalState.thread
                                              ? globalState.thread
                                              : typeof thread !== "undefined"
                                                ? thread
                                                : undefined;
                                    if (ctorFn && ctorFn._jsoopFactory) {
                                        try {
                                            // Invoke factory and record its completion promise on the
                                            // instance so callers (e.g. the `new` block) can wait
                                            // until initialization is finished before using the
                                            // newly-constructed object.
                                            const _p =
                                                vm.runtime.ext_jsoop._invokeJsoopFactory(
                                                    ctorFn,
                                                    this,
                                                    callerThread,
                                                    ctorArgs,
                                                );
                                            try {
                                                if (
                                                    _p &&
                                                    typeof _p.then ===
                                                        "function"
                                                ) {
                                                    Object.defineProperty(
                                                        this,
                                                        "_jsoopInitPromise",
                                                        {
                                                            value: _p,
                                                            writable: true,
                                                            configurable: true,
                                                            enumerable: false,
                                                        },
                                                    );
                                                }
                                            } catch (_) {}
                                        } catch (e) {
                                            console.error(
                                                "constructor invocation failed",
                                                e,
                                            );
                                        }
                                    } else if (typeof ctorFn === "function") {
                                        try {
                                            ctorFn.apply(this, ctorArgs);
                                        } catch (e) {
                                            console.error(
                                                "constructor call failed",
                                                e,
                                            );
                                        }
                                    }
                                } catch (e) {
                                    console.error(
                                        "constructor wrapper failed",
                                        e,
                                    );
                                }
                            }
                        };

                        // Ensure Wrapped.prototype methods are not strings either.
                        try {
                            const protoKeys2 = Object.getOwnPropertyNames(
                                Wrapped.prototype,
                            );
                            for (const key of protoKeys2) {
                                if (key === "constructor") continue;
                                try {
                                    const desc =
                                        Object.getOwnPropertyDescriptor(
                                            Wrapped.prototype,
                                            key,
                                        );
                                    if (!desc || typeof desc.value !== "string")
                                        continue;
                                    let src = desc.value;
                                    try {
                                        if (
                                            (src.startsWith('"') &&
                                                src.endsWith('"')) ||
                                            (src.startsWith("'") &&
                                                src.endsWith("'"))
                                        )
                                            src = JSON.parse(src);
                                    } catch (_) {}
                                    let conv = null;
                                    try {
                                        conv = stringToFunction(src);
                                    } catch (_) {
                                        conv = null;
                                    }
                                    if (typeof conv !== "function") {
                                        try {
                                            conv = new Function(
                                                "return " + src,
                                            )();
                                        } catch (_) {
                                            conv = null;
                                        }
                                    }
                                    if (typeof conv === "function") {
                                        Object.defineProperty(
                                            Wrapped.prototype,
                                            key,
                                            {
                                                value: conv,
                                                writable: true,
                                                configurable: true,
                                            },
                                        );
                                    }
                                } catch (_) {}
                            }
                        } catch (_) {}

                        // Copy static properties from the original class onto the wrapper
                        try {
                            const staticKeys = Object.getOwnPropertyNames(Base);
                            for (const key of staticKeys) {
                                if (
                                    key === "prototype" ||
                                    key === "name" ||
                                    key === "length"
                                )
                                    continue;
                                try {
                                    const desc =
                                        Object.getOwnPropertyDescriptor(
                                            Base,
                                            key,
                                        );
                                    Object.defineProperty(Wrapped, key, desc);
                                } catch (_) {}
                            }
                        } catch (_) {}

                        return Wrapped;
                    } catch (e) {
                        console.error(
                            "_makeClassFromMethods: failed to create constructor wrapper",
                            e,
                        );
                        return C;
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
                try {
                    let p = param;
                    if (
                        p &&
                        typeof p === "object" &&
                        p._jsoopLookupMarker &&
                        p.lookupId
                    ) {
                        try {
                            p = this._getFromLookupTable(p.lookupId);
                        } catch (_) {
                            p = undefined;
                        }
                        if (p instanceof this.JSObject) p = p.value;
                    } else if (p instanceof this.JSObject) {
                        p = p.value;
                    }

                    // If it's a plain object like { "...rest": undefined }
                    if (p && typeof p === "object") {
                        const keys = Object.keys(p);
                        if (keys.length === 0) return null;
                        let key = keys[0];
                        try {
                            key = JSON.parse(key);
                        } catch (_) {}
                        const match = String(key)
                            .trim()
                            .match(/^\.{0,3}\s*([A-Za-z_$][\w$]*)/);
                        return match ? match[1] : null;
                    }

                    const name = String(p || "").trim();
                    const match = name.match(/^\.{0,3}\s*([A-Za-z_$][\w$]*)/);
                    return match ? match[1] : null;
                } catch (e) {
                    return null;
                }
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
        // Removed makeCallerView: callers now receive the original caller thread directly.

        async _invokeJsoopFactory(fn, thisArg, callerThread, args) {
            const paramNames = this._getJsoopParamNames(fn);
            const defaults = fn && fn._jsoopDefaults ? fn._jsoopDefaults : {};

            const argObject = {};
            for (let i = 0; i < paramNames.length; i++) {
                let rawName = null;
                try {
                    const p =
                        fn && fn._jsoopParams ? fn._jsoopParams[i] : undefined;
                    let obj = p;
                    if (
                        obj &&
                        typeof obj === "object" &&
                        obj._jsoopLookupMarker &&
                        obj.lookupId
                    ) {
                        try {
                            obj = this._getFromLookupTable(obj.lookupId);
                        } catch (_) {
                            obj = undefined;
                        }
                        if (obj instanceof this.JSObject) obj = obj.value;
                    } else if (obj instanceof this.JSObject) {
                        obj = obj.value;
                    }
                    if (typeof obj === "string") rawName = obj;
                    else if (obj && typeof obj === "object") {
                        const keys = Object.keys(obj);
                        if (keys.length) {
                            try {
                                rawName = JSON.parse(keys[0]);
                            } catch (_) {
                                rawName = keys[0];
                            }
                        }
                    }
                } catch (_) {
                    rawName = null;
                }

                const maybeName = paramNames[i] || String(i);
                let isSpread = false;
                let name = maybeName;
                if (
                    typeof rawName === "string" &&
                    rawName.trim().startsWith("...")
                ) {
                    isSpread = true;
                    name = rawName.replace(/^\s*\.{3}/, "");
                }
                if (typeof name === "string") {
                    try {
                        const t = name.trim();
                        if (
                            (t.startsWith('"') && t.endsWith('"')) ||
                            (t.startsWith("'") && t.endsWith("'"))
                        ) {
                            name = JSON.parse(t);
                        } else {
                            name = t;
                        }
                    } catch (_) {
                        name = String(name);
                    }
                }

                if (isSpread) {
                    const remainder = [];
                    for (let j = i; j < args.length; j++) {
                        try {
                            remainder.push(
                                this._convertToNativeValue(
                                    this._getActualValue(args[j]),
                                ),
                            );
                        } catch (e) {
                            remainder.push(this._getActualValue(args[j]));
                        }
                    }
                    const useJwArray =
                        this.settings &&
                        this.settings
                            .automaticSpreadArgInClassArgsObjectToJwArrayConversion !==
                            false;
                    argObject[String(name)] =
                        useJwArray &&
                        typeof vm !== "undefined" &&
                        vm.jwArray &&
                        typeof vm.jwArray.Type === "function"
                            ? new vm.jwArray.Type(remainder)
                            : remainder;
                    break;
                } else {
                    const value =
                        i < args.length
                            ? this._getActualValue(args[i])
                            : undefined;
                    const key = maybeName;
                    argObject[key] =
                        value === undefined &&
                        Object.prototype.hasOwnProperty.call(defaults, key)
                            ? defaults[key]
                            : value;
                }
            }

            const runtime = vm.runtime;
            const Thread = vm.exports.Thread;

            const execThread = new Thread();
            execThread.target = callerThread.target;
            execThread.blockContainer = callerThread.blockContainer;
            execThread.isCompiled = true;
            execThread.status = Thread.STATUS_RUNNING;
            execThread.pushStack("__jsoop_dummy__");

            const localStringToFunction = (src) => {
                if (typeof src === "function") return src;
                if (typeof src !== "string") return null;

                let code = src;
                try {
                    if (
                        (code.startsWith('"') && code.endsWith('"')) ||
                        (code.startsWith("'") && code.endsWith("'"))
                    ) {
                        code = JSON.parse(code);
                    }
                } catch (_) {}

                try {
                    if (
                        vm &&
                        vm.exports &&
                        vm.exports.jsexecute &&
                        typeof vm.exports.jsexecute.scopedEval === "function"
                    ) {
                        try {
                            const f = vm.exports.jsexecute.scopedEval(code);
                            if (typeof f === "function") return f;
                        } catch (err) {
                            try {
                                const f2 = vm.exports.jsexecute.scopedEval(
                                    "(" + code + ")",
                                );
                                if (typeof f2 === "function") return f2;
                            } catch (_) {}
                        }
                    }
                } catch (_) {}

                try {
                    return new Function("return " + code)();
                } catch (e) {
                    try {
                        return new Function("return (" + code + ")")();
                    } catch (e2) {
                        try {
                            const wrapper = `(function() { return (${code}); })`;
                            return new Function("return " + wrapper)()();
                        } catch (_) {
                            return null;
                        }
                    }
                }
            };

            const objectMap = (obj, fn) =>
                Object.fromEntries(
                    Object.entries(obj).map(([k, v], i) => [k, fn(v, k, i)]),
                );

            // Shared-thread bridge:
            // - execThread stays the real VM thread
            // - linkedCallerThread is what the factory receives
            // - reads prefer execThread, then callerThread
            // - writes mirror to both sides
            const makeLinkedThread = (primary, secondary) => {
                const syncWrite = (prop, value) => {
                    try {
                        primary[prop] = value;
                    } catch (_) {}
                    try {
                        secondary[prop] = value;
                    } catch (_) {}
                    return true;
                };

                const syncDefine = (prop, desc) => {
                    try {
                        Object.defineProperty(primary, prop, desc);
                    } catch (_) {}
                    try {
                        Object.defineProperty(secondary, prop, desc);
                    } catch (_) {}
                    return true;
                };

                return new Proxy(primary, {
                    get(target, prop, receiver) {
                        if (prop === "_jsoopLinkedThread") return secondary;
                        if (prop === "_jsoopPrimaryThread") return primary;
                        if (prop === "_jsoopSecondaryThread") return secondary;
                        if (Reflect.has(primary, prop))
                            return Reflect.get(primary, prop, receiver);
                        if (Reflect.has(secondary, prop))
                            return Reflect.get(secondary, prop, receiver);
                        return undefined;
                    },

                    set(target, prop, value, receiver) {
                        return syncWrite(prop, value);
                    },

                    has(target, prop) {
                        return (
                            Reflect.has(primary, prop) ||
                            Reflect.has(secondary, prop)
                        );
                    },

                    deleteProperty(target, prop) {
                        try {
                            delete primary[prop];
                        } catch (_) {}
                        try {
                            delete secondary[prop];
                        } catch (_) {}
                        return true;
                    },

                    defineProperty(target, prop, desc) {
                        return syncDefine(prop, desc);
                    },

                    getOwnPropertyDescriptor(target, prop) {
                        return (
                            Object.getOwnPropertyDescriptor(primary, prop) ||
                            Object.getOwnPropertyDescriptor(secondary, prop)
                        );
                    },

                    ownKeys(target) {
                        return Array.from(
                            new Set([
                                ...Reflect.ownKeys(primary),
                                ...Reflect.ownKeys(secondary),
                            ]),
                        );
                    },

                    getPrototypeOf(target) {
                        return Object.getPrototypeOf(primary);
                    },

                    setPrototypeOf(target, proto) {
                        try {
                            Object.setPrototypeOf(primary, proto);
                        } catch (_) {}
                        try {
                            Object.setPrototypeOf(secondary, proto);
                        } catch (_) {}
                        return true;
                    },
                });
            };

            const linkedCallerThread = makeLinkedThread(
                callerThread,
                execThread,
            );

            // Keep direct references too
            execThread._jsoopCallerThread = linkedCallerThread;
            callerThread._jsoopExecThread = execThread;

            const _prevJsoopArgs = callerThread.jsoopArgs;
            const _prevProcedures = callerThread.procedures;
            callerThread.jsoopArgs =
                typeof _prevJsoopArgs === "undefined"
                    ? argObject
                    : _prevJsoopArgs;

            try {
                const _argsCandidate = callerThread.jsoopArgs;
                const proto = _argsCandidate
                    ? Object.getPrototypeOf(_argsCandidate)
                    : null;
                const looksLikePlainObject =
                    _argsCandidate &&
                    typeof _argsCandidate === "object" &&
                    !Array.isArray(_argsCandidate) &&
                    (proto === Object.prototype || proto === null);
                const isWrapperLike = !_argsCandidate
                    ? false
                    : _argsCandidate instanceof this.JSObject ||
                      (typeof vm !== "undefined" &&
                          vm &&
                          vm.jwArray &&
                          _argsCandidate instanceof vm.jwArray.Type) ||
                      (typeof vm !== "undefined" &&
                          vm &&
                          vm.dogeiscutObject &&
                          _argsCandidate instanceof vm.dogeiscutObject.Type) ||
                      Boolean(
                          _argsCandidate &&
                          (_argsCandidate.customId ||
                              _argsCandidate._jsoopLookupMarker),
                      );

                if (looksLikePlainObject && !isWrapperLike) {
                    const normalized = {};
                    for (const k of Object.keys(_argsCandidate)) {
                        let nk = k;
                        try {
                            const parsed = JSON.parse(k);
                            if (typeof parsed === "string") nk = parsed;
                        } catch (_) {
                            if (nk && nk.startsWith("...")) {
                                const sub = nk.slice(3);
                                try {
                                    const parsed2 = JSON.parse(sub);
                                    if (typeof parsed2 === "string")
                                        nk = "..." + parsed2;
                                } catch (_) {}
                            }
                        }
                        try {
                            const t = String(nk).trim();
                            if (
                                (t.startsWith('"') && t.endsWith('"')) ||
                                (t.startsWith("'") && t.endsWith("'"))
                            ) {
                                try {
                                    nk = JSON.parse(t);
                                } catch (_) {
                                    nk = t;
                                }
                            } else {
                                nk = t;
                            }
                        } catch (_) {
                            nk = String(nk);
                        }
                        normalized[nk] = _argsCandidate[k];
                    }
                    callerThread.jsoopArgs = normalized;
                }
            } catch (_) {}

            callerThread._jsoopThis = thisArg;

            try {
                let proceduresSrc = null;
                if (fn && fn._procedures) {
                    proceduresSrc = objectMap(fn._procedures, (p) =>
                        p(linkedCallerThread),
                    );
                } else if (callerThread && callerThread.procedures) {
                    proceduresSrc = callerThread.procedures;
                }

                if (proceduresSrc && typeof proceduresSrc === "object") {
                    const converted = {};
                    for (const k of Object.keys(proceduresSrc)) {
                        const v = proceduresSrc[k];
                        if (typeof v === "function") {
                            converted[k] = v;
                            continue;
                        }

                        let fnConverted = v;
                        try {
                            if (
                                typeof v === "string" &&
                                ((v.startsWith('"') && v.endsWith('"')) ||
                                    (v.startsWith("'") && v.endsWith("'")))
                            ) {
                                try {
                                    fnConverted = JSON.parse(v);
                                } catch (_) {
                                    fnConverted = v;
                                }
                            }
                        } catch (_) {
                            fnConverted = v;
                        }

                        if (typeof fnConverted === "string") {
                            const evaled = localStringToFunction(fnConverted);
                            converted[k] = evaled !== null ? evaled : v;
                        } else {
                            converted[k] = fnConverted;
                        }
                    }
                    callerThread.procedures = converted;
                }
            } catch (e) {
                try {
                    callerThread.procedures = _prevProcedures;
                } catch (_) {}
            }

            const factoryResult = fn.call(thisArg, linkedCallerThread);
            let generator;
            if (
                typeof factoryResult === "function" &&
                this._isGeneratorFunction(factoryResult)
            ) {
                generator = factoryResult();
            } else if (
                factoryResult &&
                typeof factoryResult.next === "function"
            ) {
                generator = factoryResult;
            } else {
                if (typeof _prevJsoopArgs === "undefined")
                    delete callerThread.jsoopArgs;
                else callerThread.jsoopArgs = _prevJsoopArgs;
                return factoryResult;
            }

            execThread.generator = generator;

            const originalStep = execThread.step;
            execThread.step = function (...stepArgs) {
                try {
                    return originalStep.call(this, ...stepArgs);
                } catch (e) {
                    console.error("JS OOP factory thread error:", e);
                    this.status = Thread.STATUS_DONE;
                    runtime.emit("THREAD_FINISHED", this);
                    throw e;
                }
            };

            callerThread._execThread = execThread;
            runtime.threads.push(execThread);
            runtime.threadMap.set(execThread.getId(), execThread);
            runtime.emit("THREAD_STARTED", execThread);

            return new Promise((resolve, reject) => {
                const finishHandler = (finishedThread) => {
                    if (finishedThread === execThread) {
                        runtime.removeListener(
                            "THREAD_FINISHED",
                            finishHandler,
                        );
                        let ret =
                            typeof finishedThread !== "undefined"
                                ? finishedThread.justReturned
                                : undefined;
                        if (
                            (typeof ret === "undefined" || ret === null) &&
                            callerThread &&
                            typeof callerThread.justReturned !== "undefined"
                        ) {
                            ret = callerThread.justReturned;
                        }
                        try {
                            if (typeof _prevJsoopArgs === "undefined")
                                delete callerThread.jsoopArgs;
                            else callerThread.jsoopArgs = _prevJsoopArgs;
                        } catch (_) {}
                        try {
                            if (typeof _prevProcedures === "undefined")
                                delete callerThread.procedures;
                            else callerThread.procedures = _prevProcedures;
                        } catch (_) {}
                        resolve(ret);
                    }
                };

                runtime.on("THREAD_FINISHED", finishHandler);

                if (execThread.status === Thread.STATUS_DONE) {
                    runtime.removeListener("THREAD_FINISHED", finishHandler);
                    let ret = execThread.justReturned;
                    if (
                        (typeof ret === "undefined" || ret === null) &&
                        callerThread &&
                        typeof callerThread.justReturned !== "undefined"
                    ) {
                        ret = callerThread.justReturned;
                    }
                    try {
                        if (typeof _prevJsoopArgs === "undefined")
                            delete callerThread.jsoopArgs;
                        else callerThread.jsoopArgs = _prevJsoopArgs;
                        if (typeof _prevProcedures === "undefined")
                            delete callerThread.procedures;
                        else callerThread.procedures = _prevProcedures;
                    } catch (_) {}
                    resolve(ret);
                }
            });
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
                    opcode: "setSetting",
                    blockType: Scratch.BlockType.COMMAND,
                    text: "set setting [SETTING] to [VALUE]",
                    arguments: {
                        SETTING: {
                            type: Scratch.ArgumentType.STRING,
                            menu: "settingMenu",
                        },
                        VALUE: {
                            type: Scratch.ArgumentType.BOOLEAN,
                            defaultValue: false,
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
                        VALUE: JSObjectDescriptor.ArgumentNonCheck,
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
                    text: "[METHOD_TYPE] method [NAME] named args [ARGS] [ARGSREPORTER]",
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
                        ARGS: JSObjectDescriptor.ArgumentNonCheck,
                        ARGSREPORTER: {
                            fillIn: "argsReporter",
                        },
                    },
                },
                {
                    opcode: "argsBuilder",
                    text: "args builder",
                    blockType: Scratch.BlockType.REPORTER,
                    branches: [{}],
                    ...JSObjectDescriptor.Block,
                },
                // Stack/command variants for args builder (use inside `argsBuilder` substack)
                {
                    opcode: "classArgStack",
                    text: "arg [NAME]",
                    blockType: Scratch.BlockType.COMMAND,
                    arguments: {
                        NAME: {
                            type: Scratch.ArgumentType.STRING,
                            defaultValue: "x",
                        },
                    },
                },
                {
                    opcode: "classArgStringStack",
                    text: "arg [NAME] default string [DEFAULT]",
                    blockType: Scratch.BlockType.COMMAND,
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
                    opcode: "classArgNumberStack",
                    text: "arg [NAME] default number [DEFAULT]",
                    blockType: Scratch.BlockType.COMMAND,
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
                    opcode: "classArgDogeiscutObjectStack",
                    text: "arg [NAME] default object [DEFAULT]",
                    blockType: Scratch.BlockType.COMMAND,
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
                    opcode: "classArgJwArrayStack",
                    text: "arg [NAME] default array [DEFAULT]",
                    blockType: Scratch.BlockType.COMMAND,
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
                    opcode: "classArgJSObjectStack",
                    text: "arg [NAME] default JSObject [DEFAULT]",
                    blockType: Scratch.BlockType.COMMAND,
                    arguments: {
                        NAME: {
                            type: Scratch.ArgumentType.STRING,
                            defaultValue: "x",
                        },
                        DEFAULT: JSObjectDescriptor.Argument,
                    },
                },
                {
                    opcode: "classArgDefaultStack",
                    text: "arg [NAME] default [DEFAULT]",
                    blockType: Scratch.BlockType.COMMAND,
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
                    opcode: "classArgSpreadStack",
                    text: "spread [NAME]",
                    blockType: Scratch.BlockType.COMMAND,
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
                    settingMenu: {
                        acceptReporters: false,
                        items: [
                            "Automatic arg array to native conversion",
                            "Automatic class method call args object to dogeiscutObject conversion",
                            "Automatic spread arg in class args object to jwArray conversion",
                            // hidden for now, not sure if i'll ever allow them to be set
                            //"Prefer compiled class-arg stack",
                            //"Wrap new instances in JSObject",
                            //"Enable debug logging",
                            //"Use lookup table by default",
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
                            type: block?.fields?.METHOD_TYPE?.value,
                            name: generator.descendInputOfBlock(block, "NAME"),
                            args: generator.descendInputOfBlock(block, "ARGS"),
                            substack: generator.descendSubstack(
                                block,
                                "SUBSTACK",
                            ),
                            substackTopBlockId:
                                vm.runtime.targets.find(
                                    (t) =>
                                        t.blocks._blocks[
                                            block.inputs.SUBSTACK?.block
                                        ]?.id !== undefined,
                                ).blocks._blocks[block.inputs.SUBSTACK.block]
                                    .id || null,
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
                    argsBuilder: (generator, block) => {
                        generator.script.yields = true;
                        return {
                            kind: "input",
                            substack: generator.descendSubstack(
                                block,
                                "SUBSTACK",
                            ),
                        };
                    },
                    // Only compile the stack/command arg blocks; reporter-style
                    // arg descriptors are removed in favor of the builder substack.
                    // These are command/stack variants and must be treated as
                    // "stack" in the IR so the JS generator can emit statements
                    // (it appends to `compiler.source`) instead of expressions.
                    classArgStack: (generator, block) => ({
                        kind: "stack",
                        NAME: generator.descendInputOfBlock(block, "NAME"),
                    }),
                    classArgStringStack: (generator, block) => ({
                        kind: "stack",
                        NAME: generator.descendInputOfBlock(block, "NAME"),
                        DEFAULT: generator.descendInputOfBlock(
                            block,
                            "DEFAULT",
                        ),
                    }),
                    classArgNumberStack: (generator, block) => ({
                        kind: "stack",
                        NAME: generator.descendInputOfBlock(block, "NAME"),
                        DEFAULT: generator.descendInputOfBlock(
                            block,
                            "DEFAULT",
                        ),
                    }),
                    classArgDogeiscutObjectStack: (generator, block) => ({
                        kind: "stack",
                        NAME: generator.descendInputOfBlock(block, "NAME"),
                        DEFAULT: generator.descendInputOfBlock(
                            block,
                            "DEFAULT",
                        ),
                    }),
                    classArgJwArrayStack: (generator, block) => ({
                        kind: "stack",
                        NAME: generator.descendInputOfBlock(block, "NAME"),
                        DEFAULT: generator.descendInputOfBlock(
                            block,
                            "DEFAULT",
                        ),
                    }),
                    classArgJSObjectStack: (generator, block) => ({
                        kind: "stack",
                        NAME: generator.descendInputOfBlock(block, "NAME"),
                        DEFAULT: generator.descendInputOfBlock(
                            block,
                            "DEFAULT",
                        ),
                    }),
                    classArgDefaultStack: (generator, block) => ({
                        kind: "stack",
                        NAME: generator.descendInputOfBlock(block, "NAME"),
                        DEFAULT: generator.descendInputOfBlock(
                            block,
                            "DEFAULT",
                        ),
                    }),
                    classArgSpreadStack: (generator, block) => ({
                        kind: "stack",
                        NAME: generator.descendInputOfBlock(block, "NAME"),
                    }),
                    setSetting: (generator, block) => ({
                        kind: "stack",
                        SETTING: block.fields.SETTING.value,
                        VALUE: generator.descendInputOfBlock(block, "VALUE"),
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
                    // Property accessors / setters (IR entries for compiled emitters)
                    getProp: (generator, block) => {
                        return {
                            kind: "input",
                            PROP: generator.descendInputOfBlock(block, "PROP"),
                            INSTANCE: generator.descendInputOfBlock(
                                block,
                                "INSTANCE",
                            ),
                        };
                    },
                    setPropString: (generator, block) => {
                        return {
                            kind: "stack",
                            PROP: generator.descendInputOfBlock(block, "PROP"),
                            INSTANCE: generator.descendInputOfBlock(
                                block,
                                "INSTANCE",
                            ),
                            VALUE: generator.descendInputOfBlock(
                                block,
                                "VALUE",
                            ),
                        };
                    },
                    setPropJSObject: (generator, block) => {
                        return {
                            kind: "stack",
                            PROP: generator.descendInputOfBlock(block, "PROP"),
                            INSTANCE: generator.descendInputOfBlock(
                                block,
                                "INSTANCE",
                            ),
                            VALUE: generator.descendInputOfBlock(
                                block,
                                "VALUE",
                            ),
                        };
                    },
                    setPropJwArray: (generator, block) => {
                        return {
                            kind: "stack",
                            PROP: generator.descendInputOfBlock(block, "PROP"),
                            INSTANCE: generator.descendInputOfBlock(
                                block,
                                "INSTANCE",
                            ),
                            VALUE: generator.descendInputOfBlock(
                                block,
                                "VALUE",
                            ),
                        };
                    },
                    setPropDogeiscutObject: (generator, block) => {
                        return {
                            kind: "stack",
                            PROP: generator.descendInputOfBlock(block, "PROP"),
                            INSTANCE: generator.descendInputOfBlock(
                                block,
                                "INSTANCE",
                            ),
                            VALUE: generator.descendInputOfBlock(
                                block,
                                "VALUE",
                            ),
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
                        compiler.source += `try { Object.defineProperty(C, "_jsoopHasConstructor", { value: !!(${methodsVar} && ${methodsVar}.some(function(m){ try { return String(m && m.name) === \"constructor\" && !String((m && m.type) || \"\").includes(\"static\"); } catch(e) { return false } })), writable: false, configurable: true }); } catch(_) {}
`;
                        compiler.source += `return C;`;
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
                        let procedures = {};
                        let factorySource = "";

                        let firstBlockId = node.substackTopBlockId;
                        console.log(node);
                        if (firstBlockId) {
                            //const firstBlock = node.substack[0];
                            //firstBlockId = firstBlock && firstBlock.id ? firstBlock.id : null;
                            try {
                                // Clone compiler and descend the substack to prepare any
                                // compile-time state (defaults, names, etc.). Use the
                                // child's produced source as a fallback if IR/JS fails.
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
                                if (firstBlockId) {
                                    const test = new vm.exports.Thread(
                                        firstBlockId,
                                    );
                                    test.target = vm.runtime.targets.find(
                                        (t) => firstBlockId in t.blocks._blocks,
                                    );
                                    if (test.target) {
                                        test.blockContainer =
                                            test.target.blocks;
                                        test.pushStack(firstBlockId);
                                        const ir = new vm.exports.IRGenerator(
                                            test,
                                        ).generate();
                                        const jsCompiler =
                                            new vm.exports.JSGenerator(
                                                ir.entry,
                                                ir,
                                                test.target,
                                            );
                                        jsCompiler.inClassMethod = true;
                                        const compileScript = (script) => {
                                            // taken from vm
                                            if (script.cachedCompileResult) {
                                                return script.cachedCompileResult;
                                            }

                                            const compiler =
                                                new vm.exports.JSGenerator(
                                                    script,
                                                    ir,
                                                    test.target,
                                                );
                                            const result = compiler.compile();
                                            script.cachedCompileResult = result;
                                            return result;
                                        };
                                        //console.log(ir);
                                        for (const procedureVariant of Object.keys(
                                            ir.procedures,
                                        )) {
                                            const procedureData =
                                                ir.procedures[procedureVariant];
                                            const procedureTree =
                                                compileScript(procedureData);
                                            procedures[procedureVariant] =
                                                procedureTree.toString();
                                        }
                                        let js = null;
                                        try {
                                            js = jsCompiler.compile();
                                        } catch (_e) {
                                            js = null;
                                        }
                                        if (
                                            typeof js === "string" &&
                                            js.trim()
                                        ) {
                                            factorySource = js;
                                        } else {
                                            let maybeString = null;
                                            try {
                                                if (
                                                    js &&
                                                    typeof js.toString ===
                                                        "function"
                                                )
                                                    maybeString = js.toString();
                                            } catch (_) {
                                                maybeString = null;
                                            }
                                            if (
                                                typeof maybeString ===
                                                    "string" &&
                                                maybeString.trim() &&
                                                maybeString !==
                                                    "[object Object]"
                                            ) {
                                                factorySource = maybeString;
                                            } else {
                                                factorySource =
                                                    child && child.source
                                                        ? child.source
                                                        : "(function empty(thread) {return;})";
                                            }
                                        }
                                    } else {
                                        factorySource =
                                            child.source ||
                                            "(function empty(thread) {return;})";
                                    }
                                } else {
                                    factorySource =
                                        child.source ||
                                        "(function empty(thread) {return;})";
                                }
                            } catch (e) {
                                console.error(
                                    "classMethod IR/JS compilation failed for firstBlockId",
                                    firstBlockId,
                                    e,
                                );
                                factorySource =
                                    child.source ||
                                    "(function empty(thread) {return;})";
                            }
                        } else {
                            factorySource =
                                child.source ||
                                "(function empty(thread) {return;})";
                        }

                        const type = node.type;
                        const name = compiler
                            .descendInput(node.name)
                            .asString();
                        const argsExpr = node.args
                            ? compiler.descendInput(node.args).asUnknown()
                            : "new vm.jwArray.Type([])";
                        //console.log("FFFOOOFOFOFOFOF", argsExpr, node, compiler);

                        const tempVar = compiler.localVariables.next();
                        const paramsVar = compiler.localVariables.next();
                        const defaultsVar = compiler.localVariables.next();

                        compiler.source += `let ${tempVar} = ${argsExpr};\n`;
                        compiler.source += `let ${paramsVar} = [];\n`;
                        compiler.source += `let ${defaultsVar} = {};\n`;
                        compiler.source += `if (${tempVar} instanceof vm.jwArray.Type) ${tempVar} = ${tempVar}.array;`;
                        compiler.source += `for (const item of ${tempVar}) {\n`;
                        compiler.source += `  let argObj = item instanceof vm.runtime.ext_jsoop.JSObject ? item.value : item;\n`;
                        compiler.source += `  if (argObj && typeof argObj === 'object' && argObj._jsoopLookupMarker && argObj.lookupId) {\n`;
                        compiler.source += `    argObj = vm.runtime.ext_jsoop._getFromLookupTable(argObj.lookupId);\n`;
                        compiler.source += `    if (argObj instanceof vm.runtime.ext_jsoop.JSObject) argObj = argObj.value;\n`;
                        compiler.source += `  }\n`;
                        compiler.source += `  if (argObj && typeof argObj === 'object') {\n`;
                        compiler.source += `    const keys = Object.keys(argObj);\n`;
                        compiler.source += `    const key = keys[0];\n`;
                        compiler.source += `    if (key !== undefined) {\n`;
                        compiler.source += `      ${paramsVar}.push(String(key));\n`;
                        compiler.source += `      ${defaultsVar}[String(key)] = argObj[key];\n`;
                        compiler.source += `    }\n`;
                        compiler.source += `  }\n`;
                        compiler.source += `}\n`;
                        compiler.source += `var topStack = thread._jsoopClassStack?.[thread._jsoopClassStack.length-1];\n`;
                        compiler.source += `if (topStack) {\n`;
                        compiler.source += `  topStack.push({\n`;
                        compiler.source += `    name: ${name},\n`;
                        compiler.source += `    params: ${tempVar},\n`;
                        compiler.source += `    defaults: ${defaultsVar},\n`;
                        // Wrap the compiled method body into a standalone factory
                        // expression so it can be evaluated later without needing
                        // compiler-local env injection. The wrapper returns a
                        // function(thread, ...) that itself returns a generator.

                        compiler.source += `    body: ${JSON.stringify(factorySource)},\n`;
                        compiler.source += `    procedures: ${JSON.stringify(procedures)},\n`;
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

        // Inform the caller thread whether this constructor/class was
        // marked as having a class-method 'constructor' (static flag).
        try {
          if (typeof thread !== 'undefined' && thread && ctor) {
            try { thread._jsoopClassHasConstructor = !!ctor._jsoopHasConstructor; } catch(_) {}
          }
        } catch(_) {}

        // If the class was marked as having a constructor method, attach
        // the caller thread to the ctor so the runtime wrapper can pick it up.
        try {
          if (ctor && typeof ctor === 'function' && ctor._jsoopHasConstructor) {
            try { ctor._jsoopCallerThread = thread; } catch(_) {}
          }
        } catch(_) {}

        let args = (${argsExpr});
        if (args instanceof vm.runtime.ext_jsoop.JSObject) args = args.value;
        if (args instanceof vm.jwArray.Type) args = args.array;
        if (!args) args = [];
        if (!Array.isArray(args)) args = [args];
        try {
          if (!ctor._jsoopFactory &&vm && vm.runtime && vm.runtime.ext_jsoop && vm.runtime.ext_jsoop.settings && vm.runtime.ext_jsoop.settings.automaticArgArrayToNativeConversion !== false) {
            args = args.map(function(item){ try { return vm.runtime.ext_jsoop._convertToNativeValue(item); } catch(e) { return item; } });
          }
        } catch(e) {}
        if (typeof ctor !== 'function') {
          return { error: 'Constructor is not a function' };
        }
        const inst = Reflect.construct(ctor, args);
        try {
          if (ctor && typeof ctor === 'function' && ctor._jsoopHasConstructor) {
            try { delete ctor._jsoopCallerThread; } catch(_) {}
          }
        } catch(_) {}
        return inst;
      } catch (e) {
        return { error: String(e) };
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
                                "thread._jsoopThis",
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
                            compiler.source += `(thread.justReturned = ${compiler.descendInput(node.DATA).asString()}, thread._execThread.stopThisScript(), undefined);`;
                        } else {
                            compiler.source += `(thread.justReturned = ${compiler.descendInput(node.DATA).asString()}, thread._execThread.stopThisScript(), '');`;
                        }
                    },
                    returnDataObject: (node, compiler, imports) => {
                        if (compiler.inClassMethod) {
                            compiler.source += `(thread.justReturned = ${compiler.descendInput(node.DATA).asUnknown()}, thread._execThread.stopThisScript(), undefined);`;
                        } else {
                            compiler.source += `(thread.justReturned = ${compiler.descendInput(node.DATA).asUnknown()}, thread._execThread.stopThisScript(), '');`;
                        }
                    },
                    returnDataArray: (node, compiler, imports) => {
                        if (compiler.inClassMethod) {
                            compiler.source += `(thread.justReturned = ${compiler.descendInput(node.DATA).asUnknown()}, thread._execThread.stopThisScript(), undefined);`;
                        } else {
                            compiler.source += `(thread.justReturned = ${compiler.descendInput(node.DATA).asUnknown()}, thread._execThread.stopThisScript(), '');`;
                        }
                    },
                    returnDataJsObject: (node, compiler, imports) => {
                        if (compiler.inClassMethod) {
                            compiler.source += `console.log(executeInCompatibilityLayer);(thread.justReturned = ${compiler.descendInput(node.DATA).asUnknown()}, thread._execThread.stopThisScript(), undefined);`;
                        } else {
                            compiler.source += `(thread.justReturned = ${compiler.descendInput(node.DATA).asUnknown()}, thread._execThread.stopThisScript(), '');`;
                        }
                    },

                    argsReporter: (node, compiler, imports) => {
                        return new imports.TypedInput(
                            `(thread.jsoopArgs || {})`,
                            imports.TYPE_UNKNOWN,
                        );
                    },
                    // Reporter-style classArg blocks removed; compile-only stack variants follow.
                    // Stack / command variants: push into a per-thread args stack for builder subtasks
                    classArgStack: (node, compiler, imports) => {
                        const rawName = node.NAME
                            ? compiler.descendInput(node.NAME).asString()
                            : "";
                        let nameVal = rawName;
                        try {
                            nameVal = JSON.parse(rawName);
                        } catch (_) {}
                        const key = JSON.stringify(nameVal);
                        compiler.source += `try { const topArgs = thread._jsoopArgsStack?.[thread._jsoopArgsStack.length-1]; if (topArgs) { if (vm && vm.runtime && vm.runtime.ext_jsoop && vm.runtime.ext_jsoop.settings && vm.runtime.ext_jsoop.settings.preferCompiledClassArgStack === false) { topArgs.push(new vm.runtime.ext_jsoop.JSObject({ [${key}]: undefined })); } else { topArgs.push({ [${key}]: undefined }); } } } catch(_) {}\n`;
                    },
                    classArgStringStack: (node, compiler, imports) => {
                        const rawName = node.NAME
                            ? compiler.descendInput(node.NAME).asString()
                            : "";
                        let nameVal = rawName;
                        try {
                            nameVal = JSON.parse(rawName);
                        } catch (_) {}
                        const defaultValue = node.DEFAULT
                            ? compiler.descendInput(node.DEFAULT).asUnknown()
                            : "undefined";
                        const key = JSON.stringify(nameVal);
                        compiler.source += `try { const topArgs = thread._jsoopArgsStack?.[thread._jsoopArgsStack.length-1]; if (topArgs) topArgs.push((function(){ const argObj = { [${key}]: ${defaultValue} }; return (vm && vm.runtime && vm.runtime.ext_jsoop && vm.runtime.ext_jsoop.settings && vm.runtime.ext_jsoop.settings.preferCompiledClassArgStack === false) ? new vm.runtime.ext_jsoop.JSObject(argObj) : vm.runtime.ext_jsoop._storeClassArgDefault(argObj); })()); } catch(_) {}\n`;
                    },
                    classArgNumberStack: (node, compiler, imports) => {
                        const rawName = node.NAME
                            ? compiler.descendInput(node.NAME).asString()
                            : "";
                        let nameVal = rawName;
                        try {
                            nameVal = JSON.parse(rawName);
                        } catch (_) {}
                        const defaultValue = node.DEFAULT
                            ? compiler.descendInput(node.DEFAULT).asUnknown()
                            : "undefined";
                        const key = JSON.stringify(nameVal);
                        compiler.source += `try { const topArgs = thread._jsoopArgsStack?.[thread._jsoopArgsStack.length-1]; if (topArgs) topArgs.push((function(){ const argObj = { [${key}]: ${defaultValue} }; return (vm && vm.runtime && vm.runtime.ext_jsoop && vm.runtime.ext_jsoop.settings && vm.runtime.ext_jsoop.settings.preferCompiledClassArgStack === false) ? new vm.runtime.ext_jsoop.JSObject(argObj) : vm.runtime.ext_jsoop._storeClassArgDefault(argObj); })()); } catch(_) {}\n`;
                    },
                    classArgDogeiscutObjectStack: (node, compiler, imports) => {
                        const rawName = node.NAME
                            ? compiler.descendInput(node.NAME).asString()
                            : "";
                        let nameVal = rawName;
                        try {
                            nameVal = JSON.parse(rawName);
                        } catch (_) {}
                        const defaultValue = node.DEFAULT
                            ? compiler.descendInput(node.DEFAULT).asUnknown()
                            : "undefined";
                        const key = JSON.stringify(nameVal);
                        compiler.source += `try { const topArgs = thread._jsoopArgsStack?.[thread._jsoopArgsStack.length-1]; if (topArgs) topArgs.push((function(){ const argObj = { [${key}]: ${defaultValue} }; return (vm && vm.runtime && vm.runtime.ext_jsoop && vm.runtime.ext_jsoop.settings && vm.runtime.ext_jsoop.settings.preferCompiledClassArgStack === false) ? new vm.runtime.ext_jsoop.JSObject(argObj) : vm.runtime.ext_jsoop._storeClassArgDefault(argObj); })()); } catch(_) {}\n`;
                    },
                    classArgJwArrayStack: (node, compiler, imports) => {
                        const rawName = node.NAME
                            ? compiler.descendInput(node.NAME).asString()
                            : "";
                        let nameVal = rawName;
                        try {
                            nameVal = JSON.parse(rawName);
                        } catch (_) {}
                        const defaultValue = node.DEFAULT
                            ? compiler.descendInput(node.DEFAULT).asUnknown()
                            : "undefined";
                        const key = JSON.stringify(nameVal);
                        compiler.source += `try { const topArgs = thread._jsoopArgsStack?.[thread._jsoopArgsStack.length-1]; if (topArgs) topArgs.push((function(){ const argObj = { [${key}]: ${defaultValue} }; return (vm && vm.runtime && vm.runtime.ext_jsoop && vm.runtime.ext_jsoop.settings && vm.runtime.ext_jsoop.settings.preferCompiledClassArgStack === false) ? new vm.runtime.ext_jsoop.JSObject(argObj) : vm.runtime.ext_jsoop._storeClassArgDefault(argObj); })()); } catch(_) {}\n`;
                    },
                    classArgJSObjectStack: (node, compiler, imports) => {
                        const rawName = node.NAME
                            ? compiler.descendInput(node.NAME).asString()
                            : "";
                        let nameVal = rawName;
                        try {
                            nameVal = JSON.parse(rawName);
                        } catch (_) {}
                        const defaultValue = node.DEFAULT
                            ? compiler.descendInput(node.DEFAULT).asUnknown()
                            : "undefined";
                        const key = JSON.stringify(nameVal);
                        compiler.source += `try { const topArgs = thread._jsoopArgsStack?.[thread._jsoopArgsStack.length-1]; if (topArgs) topArgs.push((function(){ const argObj = { [${key}]: ${defaultValue} }; return (vm && vm.runtime && vm.runtime.ext_jsoop && vm.runtime.ext_jsoop.settings && vm.runtime.ext_jsoop.settings.preferCompiledClassArgStack === false) ? new vm.runtime.ext_jsoop.JSObject(argObj) : vm.runtime.ext_jsoop._storeClassArgDefault(argObj); })()); } catch(_) {}\n`;
                    },
                    classArgDefaultStack: (node, compiler, imports) => {
                        const rawName = node.NAME
                            ? compiler.descendInput(node.NAME).asString()
                            : "";
                        let nameVal = rawName;
                        try {
                            nameVal = JSON.parse(rawName);
                        } catch (_) {}
                        const defaultValue = node.DEFAULT
                            ? compiler.descendInput(node.DEFAULT).asUnknown()
                            : "undefined";
                        const key = JSON.stringify(nameVal);
                        compiler.source += `try { const topArgs = thread._jsoopArgsStack?.[thread._jsoopArgsStack.length-1]; if (topArgs) topArgs.push((function(){ const argObj = { [${key}]: ${defaultValue} }; return (vm && vm.runtime && vm.runtime.ext_jsoop && vm.runtime.ext_jsoop.settings && vm.runtime.ext_jsoop.settings.preferCompiledClassArgStack === false) ? new vm.runtime.ext_jsoop.JSObject(argObj) : vm.runtime.ext_jsoop._storeClassArgDefault(argObj); })()); } catch(_) {}\n`;
                    },
                    classArgSpreadStack: (node, compiler, imports) => {
                        const rawName = node.NAME
                            ? compiler.descendInput(node.NAME).asString()
                            : "";
                        let nameVal = rawName;
                        try {
                            nameVal = JSON.parse(rawName);
                        } catch (_) {}
                        const key = JSON.stringify("..." + nameVal);
                        compiler.source += `try { const topArgs = thread._jsoopArgsStack?.[thread._jsoopArgsStack.length-1]; if (topArgs) { if (vm && vm.runtime && vm.runtime.ext_jsoop && vm.runtime.ext_jsoop.settings && vm.runtime.ext_jsoop.settings.preferCompiledClassArgStack === false) { topArgs.push(new vm.runtime.ext_jsoop.JSObject({ [${key}]: undefined })); } else { topArgs.push({ [${key}]: undefined }); } } } catch(_) {}\n`;
                    },

                    argsBuilder: (node, compiler, imports) => {
                        // Use the canonical source-save / replace / restore pattern
                        // so we generate a self-contained substack wrapper.
                        const originalSource = compiler.source;
                        const arrVar = compiler.localVariables.next();
                        compiler.source = "(yield* (function*() {";
                        compiler.source += `thread._jsoopArgsStack ??= []; let ${arrVar} = []; thread._jsoopArgsStack.push(${arrVar});\n`;
                        if (node.substack) {
                            compiler.descendStack(
                                node.substack,
                                new imports.Frame(false, undefined, true),
                            );
                        }
                        compiler.source += `${arrVar} = thread._jsoopArgsStack.pop();\n`;
                        // Validate spread usage in the args builder. Do not swallow errors here —
                        // rethrow so the outer factory handler can report them.
                        compiler.source += `try {\n`;
                        compiler.source += `  let spreadCount = 0;\n`;
                        compiler.source += `  for (let i = 0; i < ${arrVar}.length; i++) {\n`;
                        compiler.source += `    let item = ${arrVar}[i];\n`;
                        compiler.source += `    if (item instanceof vm.runtime.ext_jsoop.JSObject) item = item.value;\n`;
                        compiler.source += `    else if (item && typeof item === 'object' && item._jsoopLookupMarker && item.lookupId) {\n`;
                        compiler.source += `      let _tmp = vm.runtime.ext_jsoop._getFromLookupTable(item.lookupId);\n`;
                        compiler.source += `      if (_tmp instanceof vm.runtime.ext_jsoop.JSObject) _tmp = _tmp.value;\n`;
                        compiler.source += `      item = _tmp;\n`;
                        compiler.source += `    }\n`;
                        compiler.source += `    if (item && typeof item === 'object') {\n`;
                        compiler.source += `      const keys = Object.keys(item);\n`;
                        compiler.source += `      if (keys.length) {\n`;
                        compiler.source += `        let key = keys[0];\n`;
                        compiler.source += `        try { key = JSON.parse(String(key)); } catch (_) {\n`;
                        compiler.source += `          const m = String(keys[0]).match(/^\\.{3}['\\\"](.+)['\\\"]$/); if (m) key = '...' + m[1];\n`;
                        compiler.source += `        }\n`;
                        compiler.source += `        if (String(key).startsWith('...')) {\n`;
                        compiler.source += `          spreadCount++;\n`;
                        compiler.source += `          if (spreadCount > 1) throw new Error('Only one spread arg is allowed');\n`;
                        compiler.source += `          if (i !== ${arrVar}.length - 1) throw new Error('Spread arg must be last');\n`;
                        compiler.source += `        }\n`;
                        compiler.source += `      }\n`;
                        compiler.source += `    }\n`;
                        compiler.source += `  }\n`;
                        compiler.source += `} catch (e) { throw e; }\n`;
                        compiler.source += `try { return ((vm && vm.runtime && vm.runtime.ext_jsoop && vm.runtime.ext_jsoop.settings && vm.runtime.ext_jsoop.settings.automaticArgArrayToNativeConversion === false) ? ${arrVar} : (${arrVar}.map(function(item){ try { return vm.runtime.ext_jsoop._convertToNativeValue(item); } catch(e) { return item; } }))); } catch(e) { return ${arrVar}; } })())`;
                        const result = compiler.source;
                        compiler.source = originalSource;
                        return new imports.TypedInput(
                            result,
                            imports.TYPE_UNKNOWN,
                        );
                    },
                    constantMath: (node, compiler, imports) =>
                        new imports.TypedInput("Math", imports.TYPE_UNKNOWN),
                    constantNull: (node, compiler, imports) =>
                        new imports.TypedInput("null", imports.TYPE_UNKNOWN),
                    constantUndefined: (node, compiler, imports) =>
                        new imports.TypedInput(
                            "undefined",
                            imports.TYPE_UNKNOWN,
                        ),
                    constantObject: (node, compiler, imports) =>
                        new imports.TypedInput("Object", imports.TYPE_UNKNOWN),
                    constantArray: (node, compiler, imports) =>
                        new imports.TypedInput("Array", imports.TYPE_UNKNOWN),
                    constantString: (node, compiler, imports) =>
                        new imports.TypedInput("String", imports.TYPE_UNKNOWN),
                    constantNumber: (node, compiler, imports) =>
                        new imports.TypedInput("Number", imports.TYPE_UNKNOWN),
                    constantBoolean: (node, compiler, imports) =>
                        new imports.TypedInput("Boolean", imports.TYPE_UNKNOWN),
                    constantFunction: (node, compiler, imports) =>
                        new imports.TypedInput(
                            "Function",
                            imports.TYPE_UNKNOWN,
                        ),
                    constantAsyncFunction: (node, compiler, imports) =>
                        new imports.TypedInput(
                            "Object.getPrototypeOf(async function () {}).constructor",
                            imports.TYPE_UNKNOWN,
                        ),
                    constantDate: (node, compiler, imports) =>
                        new imports.TypedInput("Date", imports.TYPE_UNKNOWN),
                    constantRegExp: (node, compiler, imports) =>
                        new imports.TypedInput("RegExp", imports.TYPE_UNKNOWN),
                    constantJSON: (node, compiler, imports) =>
                        new imports.TypedInput("JSON", imports.TYPE_UNKNOWN),
                    constantPromise: (node, compiler, imports) =>
                        new imports.TypedInput("Promise", imports.TYPE_UNKNOWN),
                    constantError: (node, compiler, imports) =>
                        new imports.TypedInput("Error", imports.TYPE_UNKNOWN),
                    constantMap: (node, compiler, imports) =>
                        new imports.TypedInput("Map", imports.TYPE_UNKNOWN),
                    constantSet: (node, compiler, imports) =>
                        new imports.TypedInput("Set", imports.TYPE_UNKNOWN),
                    constantWeakMap: (node, compiler, imports) =>
                        new imports.TypedInput("WeakMap", imports.TYPE_UNKNOWN),
                    constantWeakSet: (node, compiler, imports) =>
                        new imports.TypedInput("WeakSet", imports.TYPE_UNKNOWN),
                    constantSymbol: (node, compiler, imports) =>
                        new imports.TypedInput("Symbol", imports.TYPE_UNKNOWN),
                    constantProxy: (node, compiler, imports) =>
                        new imports.TypedInput("Proxy", imports.TYPE_UNKNOWN),
                    constantReflect: (node, compiler, imports) =>
                        new imports.TypedInput("Reflect", imports.TYPE_UNKNOWN),
                    constantIntl: (node, compiler, imports) =>
                        new imports.TypedInput("Intl", imports.TYPE_UNKNOWN),
                    constantConsole: (node, compiler, imports) =>
                        new imports.TypedInput("console", imports.TYPE_UNKNOWN),
                    constantGlobalThis: (node, compiler, imports) =>
                        new imports.TypedInput(
                            "globalThis",
                            imports.TYPE_UNKNOWN,
                        ),
                    constantInfinity: (node, compiler, imports) =>
                        new imports.TypedInput(
                            "Infinity",
                            imports.TYPE_UNKNOWN,
                        ),
                    constantNaN: (node, compiler, imports) =>
                        new imports.TypedInput("NaN", imports.TYPE_UNKNOWN),
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
    if (!actualFn || typeof actualFn !== 'function') return undefined;
     let args = (${argsExpr});
     if (args instanceof vm.runtime.ext_jsoop.JSObject) args = args.value;
     if (args instanceof vm.jwArray.Type) args = args.array;
    if (!args) args = [];
    if (!Array.isArray(args)) args = [args];
    try { if (!actualFn._jsoopFactory && vm && vm.runtime && vm.runtime.ext_jsoop && vm.runtime.ext_jsoop.settings && vm.runtime.ext_jsoop.settings.automaticArgArrayToNativeConversion !== false) { args = args.map(function(item){ try { return vm.runtime.ext_jsoop._convertToNativeValue(item); } catch(e) { return item; } }); } } catch(e) {}
    if (actualFn && actualFn._jsoopFactory) {
      const clonedThread = thread //typeof thread !== 'undefined' && thread && typeof thread.clone === 'function' ? thread.clone() : thread;
      if (!clonedThread) return undefined;

       clonedThread.jsoopArgs = {};
       clonedThread._jsoopCallerTarget = target;
       clonedThread._jsoopMethodTarget = __target;
       window.fooo = actualFn._jsoopParams;
       const paramNames = Array.isArray(actualFn._jsoopParams)
         ? actualFn._jsoopParams.map(function(p) {
             try {
               var obj = p;
               if (obj && typeof obj === 'object' && obj._jsoopLookupMarker && obj.lookupId) {
                 obj = vm.runtime.ext_jsoop._getFromLookupTable(obj.lookupId);
                 if (obj instanceof vm.runtime.ext_jsoop.JSObject) obj = obj.value;
               } else if (obj instanceof vm.runtime.ext_jsoop.JSObject) {
                 obj = obj.value;
               }
               if (typeof obj === 'string') return obj;
               if (obj && typeof obj === 'object') {
                 const keys = Object.keys(obj);
                 if (keys.length) {
                   const key = keys[0];
                   try {
                     return JSON.parse(key);
                   } catch (_) {
                     return key;
                   }
                 }
               }
               return null;
             } catch (e) {
               return null;
             }
           })
         : [];
       for (let i = 0; i < paramNames.length; i++) {
         var rawName = null;
         try {
           const p = actualFn._jsoopParams && actualFn._jsoopParams[i];
           let obj = p;
           if (obj && typeof obj === 'object' && obj._jsoopLookupMarker && obj.lookupId) {
             obj = vm.runtime.ext_jsoop._getFromLookupTable(obj.lookupId);
             if (obj instanceof vm.runtime.ext_jsoop.JSObject) obj = obj.value;
           } else if (obj instanceof vm.runtime.ext_jsoop.JSObject) {
             obj = obj.value;
           }
           if (typeof obj === 'string') rawName = obj;
           else if (obj && typeof obj === 'object') {
             const keys = Object.keys(obj);
             if (keys.length) {
               try { rawName = JSON.parse(keys[0]); } catch (_) { rawName = keys[0]; }
             }
           }
         } catch (_) { rawName = null; }
         if (rawName == null) rawName = (paramNames[i] == null ? i : paramNames[i]);
         var isSpread = false;
         var name = rawName;
         if (typeof name === 'string' && name.trim().startsWith('...')) {
           isSpread = true;
           name = name.replace(/^\s*\.{3}/, '');
         }
         var def;
         const p = actualFn._jsoopParams && actualFn._jsoopParams[i];
         var pval = p;
         if (pval && typeof pval === 'object' && pval._jsoopLookupMarker && pval.lookupId) {
           pval = vm.runtime.ext_jsoop._getFromLookupTable(pval.lookupId);
           if (pval instanceof vm.runtime.ext_jsoop.JSObject) pval = pval.value;
         } else if (pval instanceof vm.runtime.ext_jsoop.JSObject) {
           pval = pval.value;
         }
         if (pval && typeof pval === 'object') {
           for (const k in pval) {
             try {
               const parsed = JSON.parse(k);
               if (parsed == paramNames[i]) { def = pval[k]; break; }
             } catch (_) {
               if (k == paramNames[i] || k == ('"' + paramNames[i] + '"') || k == rawName) { def = pval[k]; break; }
             }
           }
         }
            if (isSpread) {
           const remainder = Array.isArray(args) ? args.slice(i) : [];
           if (vm && vm.runtime && vm.runtime.ext_jsoop && vm.runtime.ext_jsoop.settings && vm.runtime.ext_jsoop.settings.automaticSpreadArgInClassArgsObjectToJwArrayConversion !== false) {
             clonedThread.jsoopArgs[String(name)] = new vm.jwArray.Type((remainder || []).map(function(item){ try { return (vm && vm.runtime && vm.runtime.ext_jsoop && typeof vm.runtime.ext_jsoop._convertToNativeValue === 'function') ? vm.runtime.ext_jsoop._convertToNativeValue(item) : item; } catch(e) { return item; } }));
           } else {
             clonedThread.jsoopArgs[String(name)] = remainder;
           }
           break;
         } else {
           clonedThread.jsoopArgs[String(name)] = (i < args.length && typeof args[i] !== 'undefined') ? args[i] : def;
         }
       }
       if (vm.runtime.ext_jsoop.settings.automaticClassMethodCallArgsObjectToDogeiscutObject) clonedThread.jsoopArgs = new vm.dogeiscutObject.Type(clonedThread.jsoopArgs);
      try { actualFn._jsoopOwnerTarget = method; } catch (_) {}
      return yield* waitPromise(vm.runtime.ext_jsoop._invokeJsoopFactory(actualFn, target, clonedThread, args));
    }
     const result = actualFn.apply(target, actualFn && actualFn._jsoopMethod ? [thread].concat(args) : args);
    if (result && typeof result.next === 'function') return yield* result;
    return result;
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
      try { if (vm && vm.runtime && vm.runtime.ext_jsoop && vm.runtime.ext_jsoop.settings && vm.runtime.ext_jsoop.settings.automaticArgArrayToNativeConversion !== false) { args = args.map(function(item){ try { return vm.runtime.ext_jsoop._convertToNativeValue(item); } catch(e) { return item; } }); } } catch(e) {}
      if (actualFn && actualFn._jsoopFactory) {
      const clonedThread = thread //typeof thread !== 'undefined' && thread && typeof thread.clone === 'function' ? thread.clone() : thread;
      if (!clonedThread) return undefined;

       clonedThread.jsoopArgs = {};
       clonedThread._jsoopCallerTarget = target;
       clonedThread._jsoopMethodTarget = __target;
       window.fooo = actualFn._jsoopParams;
       const paramNames = Array.isArray(actualFn._jsoopParams)
         ? actualFn._jsoopParams.map(function(p) {
             try {
               var obj = p;
               if (obj && typeof obj === 'object' && obj._jsoopLookupMarker && obj.lookupId) {
                 obj = vm.runtime.ext_jsoop._getFromLookupTable(obj.lookupId);
                 if (obj instanceof vm.runtime.ext_jsoop.JSObject) obj = obj.value;
               } else if (obj instanceof vm.runtime.ext_jsoop.JSObject) {
                 obj = obj.value;
               }
               if (typeof obj === 'string') return obj;
               if (obj && typeof obj === 'object') {
                 const keys = Object.keys(obj);
                 if (keys.length) {
                   const key = keys[0];
                   try { return JSON.parse(key); } catch (_) { return key; }
                 }
               }
               return null;
             } catch (e) { return null; }
           })
         : [];
       for (let i = 0; i < paramNames.length; i++) {
         var rawName = null;
         try {
           const p = actualFn._jsoopParams && actualFn._jsoopParams[i];
           let obj = p;
           if (obj && typeof obj === 'object' && obj._jsoopLookupMarker && obj.lookupId) {
             obj = vm.runtime.ext_jsoop._getFromLookupTable(obj.lookupId);
             if (obj instanceof vm.runtime.ext_jsoop.JSObject) obj = obj.value;
           } else if (obj instanceof vm.runtime.ext_jsoop.JSObject) {
             obj = obj.value;
           }
           if (typeof obj === 'string') rawName = obj;
           else if (obj && typeof obj === 'object') {
             const keys = Object.keys(obj);
             if (keys.length) {
               try { rawName = JSON.parse(keys[0]); } catch (_) { rawName = keys[0]; }
             }
           }
         } catch (_) { rawName = null; }
         if (rawName == null) rawName = (paramNames[i] == null ? i : paramNames[i]);
         var isSpread = false;
         var name = rawName;
         if (typeof name === 'string' && name.trim().startsWith('...')) {
           isSpread = true;
           name = name.replace(/^\s*\.{3}/, '');
         }
         var def;
         const p = actualFn._jsoopParams && actualFn._jsoopParams[i];
         var pval = p;
         if (pval && typeof pval === 'object' && pval._jsoopLookupMarker && pval.lookupId) {
           pval = vm.runtime.ext_jsoop._getFromLookupTable(pval.lookupId);
           if (pval instanceof vm.runtime.ext_jsoop.JSObject) pval = pval.value;
         } else if (pval instanceof vm.runtime.ext_jsoop.JSObject) {
           pval = pval.value;
         }
         if (pval && typeof pval === 'object') {
           for (const k in pval) {
             try {
               const parsed = JSON.parse(k);
               if (parsed == paramNames[i]) { def = pval[k]; break; }
             } catch (_) {
               if (k == paramNames[i] || k == ('"' + paramNames[i] + '"') || k == rawName) { def = pval[k]; break; }
             }
           }
         }
           if (isSpread) {
           const remainder = Array.isArray(args) ? args.slice(i) : [];
           if (vm && vm.runtime && vm.runtime.ext_jsoop && vm.runtime.ext_jsoop.settings && vm.runtime.ext_jsoop.settings.automaticSpreadArgInClassArgsObjectToJwArrayConversion !== false) {
             clonedThread.jsoopArgs[String(name)] = new vm.jwArray.Type((remainder || []).map(function(item){ try { return (vm && vm.runtime && vm.runtime.ext_jsoop && typeof vm.runtime.ext_jsoop._convertToNativeValue === 'function') ? vm.runtime.ext_jsoop._convertToNativeValue(item) : item; } catch(e) { return item; } }));
           } else {
             clonedThread.jsoopArgs[String(name)] = remainder;
           }
           break;
         } else {
           clonedThread.jsoopArgs[String(name)] = (i < args.length && typeof args[i] !== 'undefined') ? args[i] : def;
         }
       }
       if (vm.runtime.ext_jsoop.settings.automaticClassMethodCallArgsObjectToDogeiscutObject) clonedThread.jsoopArgs = new vm.dogeiscutObject.Type(clonedThread.jsoopArgs);
      try { actualFn._jsoopOwnerTarget = method; } catch (_) {}
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
    if (!actualFunc || typeof actualFunc !== 'function') return undefined;
     let args = (${argsExpr});
     if (args instanceof vm.runtime.ext_jsoop.JSObject) args = args.value;
     if (args instanceof vm.jwArray.Type) args = args.array;
    if (!args) args = [];
    if (!Array.isArray(args)) args = [args];
      try { if (vm && vm.runtime && vm.runtime.ext_jsoop && vm.runtime.ext_jsoop.settings && vm.runtime.ext_jsoop.settings.automaticArgArrayToNativeConversion !== false) { args = args.map(function(item){ try { return vm.runtime.ext_jsoop._convertToNativeValue(item); } catch(e) { return item; } }); } } catch(e) {}
      if (actualFunc && actualFunc._jsoopFactory) {
      const clonedThread = thread //typeof thread !== 'undefined' && thread && typeof thread.clone === 'function' ? thread.clone() : thread;
      if (!clonedThread) return undefined;

       clonedThread.jsoopArgs = {};
       clonedThread._jsoopCallerTarget = target;
       clonedThread._jsoopMethodTarget = __target;
       window.fooo = actualFn._jsoopParams;
       const paramNames = Array.isArray(actualFn._jsoopParams)
         ? actualFn._jsoopParams.map(function(p) {
             try {
               var obj = p;
               if (obj && typeof obj === 'object' && obj._jsoopLookupMarker && obj.lookupId) {
                 obj = vm.runtime.ext_jsoop._getFromLookupTable(obj.lookupId);
                 if (obj instanceof vm.runtime.ext_jsoop.JSObject) obj = obj.value;
               } else if (obj instanceof vm.runtime.ext_jsoop.JSObject) {
                 obj = obj.value;
               }
               if (typeof obj === 'string') return obj;
               if (obj && typeof obj === 'object') {
                 const keys = Object.keys(obj);
                 if (keys.length) {
                   const key = keys[0];
                   try { return JSON.parse(key); } catch (_) { return key; }
                 }
               }
               return null;
             } catch (e) { return null; }
           })
         : [];
       for (let i = 0; i < paramNames.length; i++) {
         var rawName = null;
         try {
           const p = actualFn._jsoopParams && actualFn._jsoopParams[i];
           let obj = p;
           if (obj && typeof obj === 'object' && obj._jsoopLookupMarker && obj.lookupId) {
             obj = vm.runtime.ext_jsoop._getFromLookupTable(obj.lookupId);
             if (obj instanceof vm.runtime.ext_jsoop.JSObject) obj = obj.value;
           } else if (obj instanceof vm.runtime.ext_jsoop.JSObject) {
             obj = obj.value;
           }
           if (typeof obj === 'string') rawName = obj;
           else if (obj && typeof obj === 'object') {
             const keys = Object.keys(obj);
             if (keys.length) {
               try { rawName = JSON.parse(keys[0]); } catch (_) { rawName = keys[0]; }
             }
           }
         } catch (_) { rawName = null; }
         if (rawName == null) rawName = (paramNames[i] == null ? i : paramNames[i]);
         var isSpread = false;
         var name = rawName;
         if (typeof name === 'string' && name.trim().startsWith('...')) {
           isSpread = true;
           name = name.replace(/^\s*\.{3}/, '');
         }
         var def;
         const p = actualFn._jsoopParams && actualFn._jsoopParams[i];
         var pval = p;
         if (pval && typeof pval === 'object' && pval._jsoopLookupMarker && pval.lookupId) {
           pval = vm.runtime.ext_jsoop._getFromLookupTable(pval.lookupId);
           if (pval instanceof vm.runtime.ext_jsoop.JSObject) pval = pval.value;
         } else if (pval instanceof vm.runtime.ext_jsoop.JSObject) {
           pval = pval.value;
         }
         if (pval && typeof pval === 'object') {
           for (const k in pval) {
             try {
               const parsed = JSON.parse(k);
               if (parsed == paramNames[i]) { def = pval[k]; break; }
             } catch (_) {
               if (k == paramNames[i] || k == ('"' + paramNames[i] + '"') || k == rawName) { def = pval[k]; break; }
             }
           }
         }
           if (isSpread) {
           const remainder = Array.isArray(args) ? args.slice(i) : [];
           if (vm && vm.runtime && vm.runtime.ext_jsoop && vm.runtime.ext_jsoop.settings && vm.runtime.ext_jsoop.settings.automaticSpreadArgInClassArgsObjectToJwArrayConversion !== false) {
             clonedThread.jsoopArgs[String(name)] = new vm.jwArray.Type((remainder || []).map(function(item){ try { return (vm && vm.runtime && vm.runtime.ext_jsoop && typeof vm.runtime.ext_jsoop._convertToNativeValue === 'function') ? vm.runtime.ext_jsoop._convertToNativeValue(item) : item; } catch(e) { return item; } }));
           } else {
             clonedThread.jsoopArgs[String(name)] = remainder;
           }
           break;
         } else {
           clonedThread.jsoopArgs[String(name)] = (i < args.length && typeof args[i] !== 'undefined') ? args[i] : def;
         }
       }
       if (vm.runtime.ext_jsoop.settings.automaticClassMethodCallArgsObjectToDogeiscutObject) clonedThread.jsoopArgs = new vm.dogeiscutObject.Type(clonedThread.jsoopArgs);
      try { actualFunc._jsoopOwnerTarget = func; } catch (_) {}
      return yield* waitPromise(vm.runtime.ext_jsoop._invokeJsoopFactory(actualFunc, target, clonedThread, args));
    }
     const result = actualFunc.apply(target, actualFunc && actualFunc._jsoopMethod ? [thread].concat(args) : args);
    if (result && typeof result.next === 'function') return yield* result;
    return result;
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
      try { if (vm && vm.runtime && vm.runtime.ext_jsoop && vm.runtime.ext_jsoop.settings && vm.runtime.ext_jsoop.settings.automaticArgArrayToNativeConversion !== false) { args = args.map(function(item){ try { return vm.runtime.ext_jsoop._convertToNativeValue(item); } catch(e) { return item; } }); } } catch(e) {}
      if (actualFunc && actualFunc._jsoopFactory) {
      const clonedThread = thread //typeof thread !== 'undefined' && thread && typeof thread.clone === 'function' ? thread.clone() : thread;
      if (!clonedThread) return undefined;

       clonedThread.jsoopArgs = {};
       clonedThread._jsoopCallerTarget = target;
       clonedThread._jsoopMethodTarget = __target;
       window.fooo = actualFn._jsoopParams;
       const paramNames = Array.isArray(actualFn._jsoopParams)
         ? actualFn._jsoopParams.map(function(p) {
             try {
               var obj = p;
               if (obj && typeof obj === 'object' && obj._jsoopLookupMarker && obj.lookupId) {
                 obj = vm.runtime.ext_jsoop._getFromLookupTable(obj.lookupId);
                 if (obj instanceof vm.runtime.ext_jsoop.JSObject) obj = obj.value;
               } else if (obj instanceof vm.runtime.ext_jsoop.JSObject) {
                 obj = obj.value;
               }
               if (typeof obj === 'string') return obj;
               if (obj && typeof obj === 'object') {
                 const keys = Object.keys(obj);
                 if (keys.length) {
                   const key = keys[0];
                   try { return JSON.parse(key); } catch (_) { return key; }
                 }
               }
               return null;
             } catch (e) { return null; }
           })
         : [];
       for (let i = 0; i < paramNames.length; i++) {
         var rawName = null;
         try {
           const p = actualFn._jsoopParams && actualFn._jsoopParams[i];
           let obj = p;
           if (obj && typeof obj === 'object' && obj._jsoopLookupMarker && obj.lookupId) {
             obj = vm.runtime.ext_jsoop._getFromLookupTable(obj.lookupId);
             if (obj instanceof vm.runtime.ext_jsoop.JSObject) obj = obj.value;
           } else if (obj instanceof vm.runtime.ext_jsoop.JSObject) {
             obj = obj.value;
           }
           if (typeof obj === 'string') rawName = obj;
           else if (obj && typeof obj === 'object') {
             const keys = Object.keys(obj);
             if (keys.length) {
               try { rawName = JSON.parse(keys[0]); } catch (_) { rawName = keys[0]; }
             }
           }
         } catch (_) { rawName = null; }
         if (rawName == null) rawName = (paramNames[i] == null ? i : paramNames[i]);
         var isSpread = false;
         var name = rawName;
         if (typeof name === 'string' && name.trim().startsWith('...')) {
           isSpread = true;
           name = name.replace(/^\s*\.{3}/, '');
         }
         var def;
         const p = actualFn._jsoopParams && actualFn._jsoopParams[i];
         if (p && typeof p === 'object') {
           for (const k in p) {
             try {
               const parsed = JSON.parse(k);
               if (parsed == paramNames[i]) { def = p[k]; break; }
             } catch (_) {
               if (k == paramNames[i] || k == ('"' + paramNames[i] + '"') || k == rawName) { def = p[k]; break; }
             }
           }
         }
         if (isSpread) {
           const remainder = Array.isArray(args) ? args.slice(i) : [];
           if (vm && vm.runtime && vm.runtime.ext_jsoop && vm.runtime.ext_jsoop.settings && vm.runtime.ext_jsoop.settings.automaticSpreadArgInClassArgsObjectToJwArrayConversion !== false) {
             clonedThread.jsoopArgs[String(name)] = new vm.jwArray.Type((remainder || []).map(function(item){ try { return (vm && vm.runtime && vm.runtime.ext_jsoop && typeof vm.runtime.ext_jsoop._convertToNativeValue === 'function') ? vm.runtime.ext_jsoop._convertToNativeValue(item) : item; } catch(e) { return item; } }));
           } else {
             clonedThread.jsoopArgs[String(name)] = remainder;
           }
           break;
         } else {
           clonedThread.jsoopArgs[String(name)] = (i < args.length && typeof args[i] !== 'undefined') ? args[i] : def;
         }
       }
       if (vm.runtime.ext_jsoop.settings.automaticClassMethodCallArgsObjectToDogeiscutObject) clonedThread.jsoopArgs = new vm.dogeiscutObject.Type(clonedThread.jsoopArgs);
      try { actualFunc._jsoopOwnerTarget = func; } catch (_) {}
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
     const proto = target !== null && target !== undefined ? Object.getPrototypeOf(target) : null;
     const fn = (target && target[method]) || (proto && proto[method]);
     const actualFn = fn instanceof vm.runtime.ext_jsoop.JSObject ? fn.value : fn;
    if (!actualFn || typeof actualFn !== 'function') return undefined;

     let args = (${argsExpr});
     if (args instanceof vm.runtime.ext_jsoop.JSObject) args = args.value;
     if (args instanceof vm.jwArray.Type) args = args.array;
    if (!args) args = [];
    if (!Array.isArray(args)) args = [args];
      try { if (vm && vm.runtime && vm.runtime.ext_jsoop && vm.runtime.ext_jsoop.settings && vm.runtime.ext_jsoop.settings.automaticArgArrayToNativeConversion !== false) { args = args.map(function(item){ try { return vm.runtime.ext_jsoop._convertToNativeValue(item); } catch(e) { return item; } }); } } catch(e) {}

    if (actualFn && actualFn._jsoopFactory) {
      const clonedThread = thread //typeof thread !== 'undefined' && thread && typeof thread.clone === 'function' ? thread.clone() : thread;
      if (!clonedThread) return undefined;

       clonedThread.jsoopArgs = {};
       clonedThread._jsoopCallerTarget = target;
       clonedThread._jsoopMethodTarget = __target;
       window.fooo = actualFn._jsoopParams;
       const paramNames = Array.isArray(actualFn._jsoopParams)
         ? actualFn._jsoopParams.map(function(p) {
             try {
               var obj = p;
               if (obj && typeof obj === 'object' && obj._jsoopLookupMarker && obj.lookupId) {
                 obj = vm.runtime.ext_jsoop._getFromLookupTable(obj.lookupId);
                 if (obj instanceof vm.runtime.ext_jsoop.JSObject) obj = obj.value;
               } else if (obj instanceof vm.runtime.ext_jsoop.JSObject) {
                 obj = obj.value;
               }
               if (typeof obj === 'string') return obj;
               if (obj && typeof obj === 'object') {
                 const keys = Object.keys(obj);
                 if (keys.length) {
                   const key = keys[0];
                   try { return JSON.parse(key); } catch (_) { return key; }
                 }
               }
               return null;
             } catch (e) { return null; }
           })
         : [];
       for (let i = 0; i < paramNames.length; i++) {
         var rawName = null;
         try {
           const p = actualFn._jsoopParams && actualFn._jsoopParams[i];
           let obj = p;
           if (obj && typeof obj === 'object' && obj._jsoopLookupMarker && obj.lookupId) {
             obj = vm.runtime.ext_jsoop._getFromLookupTable(obj.lookupId);
             if (obj instanceof vm.runtime.ext_jsoop.JSObject) obj = obj.value;
           } else if (obj instanceof vm.runtime.ext_jsoop.JSObject) {
             obj = obj.value;
           }
           if (typeof obj === 'string') rawName = obj;
           else if (obj && typeof obj === 'object') {
             const keys = Object.keys(obj);
             if (keys.length) {
               try { rawName = JSON.parse(keys[0]); } catch (_) { rawName = keys[0]; }
             }
           }
         } catch (_) { rawName = null; }
         if (rawName == null) rawName = (paramNames[i] == null ? i : paramNames[i]);
         var isSpread = false;
         var name = rawName;
         if (typeof name === 'string' && name.trim().startsWith('...')) {
           isSpread = true;
           name = name.replace(/^\s*\.{3}/, '');
         }
         var def;
         const p = actualFn._jsoopParams && actualFn._jsoopParams[i];
         if (p && typeof p === 'object') {
           for (const k in p) {
             try {
               const parsed = JSON.parse(k);
               if (parsed == paramNames[i]) { def = p[k]; break; }
             } catch (_) {
               if (k == paramNames[i] || k == ('"' + paramNames[i] + '"') || k == rawName) { def = p[k]; break; }
             }
           }
         }
         if (isSpread) {
           const remainder = Array.isArray(args) ? args.slice(i) : [];
           if (vm && vm.runtime && vm.runtime.ext_jsoop && vm.runtime.ext_jsoop.settings && vm.runtime.ext_jsoop.settings.automaticSpreadArgInClassArgsObjectToJwArrayConversion !== false) {
             clonedThread.jsoopArgs[String(name)] = new vm.jwArray.Type((remainder || []).map(function(item){ try { return (vm && vm.runtime && vm.runtime.ext_jsoop && typeof vm.runtime.ext_jsoop._convertToNativeValue === 'function') ? vm.runtime.ext_jsoop._convertToNativeValue(item) : item; } catch(e) { return item; } }));
           } else {
             clonedThread.jsoopArgs[String(name)] = remainder;
           }
           break;
         } else {
           clonedThread.jsoopArgs[String(name)] = (i < args.length && typeof args[i] !== 'undefined') ? args[i] : def;
         }
       }
       if (vm.runtime.ext_jsoop.settings.automaticClassMethodCallArgsObjectToDogeiscutObject) clonedThread.jsoopArgs = new vm.dogeiscutObject.Type(clonedThread.jsoopArgs);

       actualFn._jsoopOwnerTarget = __target;
      
       const result = yield* waitPromise(
         vm.runtime.ext_jsoop._invokeJsoopFactory(actualFn, target, clonedThread, args)
       );
       return result;
     }
    
     const result = actualFn.apply(target, actualFn && actualFn._jsoopMethod ? [thread].concat(args) : args);
     if (result && typeof result.next === 'function') return yield* result;
     if (result && typeof result.then === 'function') {
       return yield* waitPromise(result);
     }
     return result;
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
    try { if (vm && vm.runtime && vm.runtime.ext_jsoop && vm.runtime.ext_jsoop.settings && vm.runtime.ext_jsoop.settings.automaticArgArrayToNativeConversion !== false) { args = args.map(function(item){ try { return vm.runtime.ext_jsoop._convertToNativeValue(item); } catch(e) { return item; } }); } } catch(e) {}
     if (actualFn && actualFn._jsoopFactory) {
       const clonedThread = thread //typeof thread !== 'undefined' && thread && typeof thread.clone === 'function' ? thread.clone() : thread;
      if (!clonedThread) return undefined;

       clonedThread.jsoopArgs = {};
       clonedThread._jsoopCallerTarget = target;
       clonedThread._jsoopMethodTarget = __target;
       window.fooo = actualFn._jsoopParams;
       const paramNames = Array.isArray(actualFn._jsoopParams)
         ? actualFn._jsoopParams.map(function(p) {
             try {
               var obj = p;
               if (obj && typeof obj === 'object' && obj._jsoopLookupMarker && obj.lookupId) {
                 obj = vm.runtime.ext_jsoop._getFromLookupTable(obj.lookupId);
                 if (obj instanceof vm.runtime.ext_jsoop.JSObject) obj = obj.value;
               } else if (obj instanceof vm.runtime.ext_jsoop.JSObject) {
                 obj = obj.value;
               }
               if (typeof obj === 'string') return obj;
               if (obj && typeof obj === 'object') {
                 const keys = Object.keys(obj);
                 if (keys.length) {
                   const key = keys[0];
                   try { return JSON.parse(key); } catch (_) { return key; }
                 }
               }
               return null;
             } catch (e) { return null; }
           })
         : [];
       for (let i = 0; i < paramNames.length; i++) {
         var rawName = null;
         try {
           const p = actualFn._jsoopParams && actualFn._jsoopParams[i];
           let obj = p;
           if (obj && typeof obj === 'object' && obj._jsoopLookupMarker && obj.lookupId) {
             obj = vm.runtime.ext_jsoop._getFromLookupTable(obj.lookupId);
             if (obj instanceof vm.runtime.ext_jsoop.JSObject) obj = obj.value;
           } else if (obj instanceof vm.runtime.ext_jsoop.JSObject) {
             obj = obj.value;
           }
           if (typeof obj === 'string') rawName = obj;
           else if (obj && typeof obj === 'object') {
             const keys = Object.keys(obj);
             if (keys.length) {
               try { rawName = JSON.parse(keys[0]); } catch (_) { rawName = keys[0]; }
             }
           }
         } catch (_) { rawName = null; }
         if (rawName == null) rawName = (paramNames[i] == null ? i : paramNames[i]);
         var isSpread = false;
         var name = rawName;
         if (typeof name === 'string' && name.trim().startsWith('...')) {
           isSpread = true;
           name = name.replace(/^\s*\.{3}/, '');
         }
         var def;
         const p = actualFn._jsoopParams && actualFn._jsoopParams[i];
         if (p && typeof p === 'object') {
           for (const k in p) {
             try {
               const parsed = JSON.parse(k);
               if (parsed == paramNames[i]) { def = p[k]; break; }
             } catch (_) {
               if (k == paramNames[i] || k == ('"' + paramNames[i] + '"') || k == rawName) { def = p[k]; break; }
             }
           }
         }
         if (isSpread) {
           const remainder = Array.isArray(args) ? args.slice(i) : [];
           if (vm && vm.runtime && vm.runtime.ext_jsoop && vm.runtime.ext_jsoop.settings && vm.runtime.ext_jsoop.settings.automaticSpreadArgInClassArgsObjectToJwArrayConversion !== false) {
             clonedThread.jsoopArgs[String(name)] = new vm.jwArray.Type((remainder || []).map(function(item){ try { return (vm && vm.runtime && vm.runtime.ext_jsoop && typeof vm.runtime.ext_jsoop._convertToNativeValue === 'function') ? vm.runtime.ext_jsoop._convertToNativeValue(item) : item; } catch(e) { return item; } }));
           } else {
             clonedThread.jsoopArgs[String(name)] = remainder;
           }
           break;
         } else {
           clonedThread.jsoopArgs[String(name)] = (i < args.length && typeof args[i] !== 'undefined') ? args[i] : def;
         }
       }
       if (vm.runtime.ext_jsoop.settings.automaticClassMethodCallArgsObjectToDogeiscutObject) clonedThread.jsoopArgs = new vm.dogeiscutObject.Type(clonedThread.jsoopArgs);
       try { actualFn._jsoopOwnerTarget = method; } catch (_) {}
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
    if (!actualFunc || typeof actualFunc !== 'function') return undefined;
     let args = (${argsExpr});
     if (args instanceof vm.runtime.ext_jsoop.JSObject) args = args.value;
     if (args instanceof vm.jwArray.Type) args = args.array;
    if (!args) args = [];
    if (!Array.isArray(args)) args = [args];
      try { if (vm && vm.runtime && vm.runtime.ext_jsoop && vm.runtime.ext_jsoop.settings && vm.runtime.ext_jsoop.settings.automaticArgArrayToNativeConversion !== false) { args = args.map(function(item){ try { return vm.runtime.ext_jsoop._convertToNativeValue(item); } catch(e) { return item; } }); } } catch(e) {}
    if (actualFunc && actualFunc._jsoopFactory) {
       const clonedThread = thread //typeof thread !== 'undefined' && thread && typeof thread.clone === 'function' ? thread.clone() : thread;
      if (!clonedThread) return undefined;

       clonedThread.jsoopArgs = {};
       clonedThread._jsoopCallerTarget = target;
       clonedThread._jsoopMethodTarget = __target;
       window.fooo = actualFn._jsoopParams;
       const paramNames = Array.isArray(actualFn._jsoopParams)
         ? actualFn._jsoopParams.map(function(p) {
             try {
               var obj = p;
               if (obj && typeof obj === 'object' && obj._jsoopLookupMarker && obj.lookupId) {
                 obj = vm.runtime.ext_jsoop._getFromLookupTable(obj.lookupId);
                 if (obj instanceof vm.runtime.ext_jsoop.JSObject) obj = obj.value;
               } else if (obj instanceof vm.runtime.ext_jsoop.JSObject) {
                 obj = obj.value;
               }
               if (typeof obj === 'string') return obj;
               if (obj && typeof obj === 'object') {
                 const keys = Object.keys(obj);
                 if (keys.length) {
                   const key = keys[0];
                   try { return JSON.parse(key); } catch (_) { return key; }
                 }
               }
               return null;
             } catch (e) { return null; }
           })
         : [];
       for (let i = 0; i < paramNames.length; i++) {
         var rawName = null;
         try {
           const p = actualFn._jsoopParams && actualFn._jsoopParams[i];
           let obj = p;
           if (obj && typeof obj === 'object' && obj._jsoopLookupMarker && obj.lookupId) {
             obj = vm.runtime.ext_jsoop._getFromLookupTable(obj.lookupId);
             if (obj instanceof vm.runtime.ext_jsoop.JSObject) obj = obj.value;
           } else if (obj instanceof vm.runtime.ext_jsoop.JSObject) {
             obj = obj.value;
           }
           if (typeof obj === 'string') rawName = obj;
           else if (obj && typeof obj === 'object') {
             const keys = Object.keys(obj);
             if (keys.length) {
               try { rawName = JSON.parse(keys[0]); } catch (_) { rawName = keys[0]; }
             }
           }
         } catch (_) { rawName = null; }
         if (rawName == null) rawName = (paramNames[i] == null ? i : paramNames[i]);
         var isSpread = false;
         var name = rawName;
         if (typeof name === 'string' && name.trim().startsWith('...')) {
           isSpread = true;
           name = name.replace(/^\s*\.{3}/, '');
         }
         var def;
         const p = actualFn._jsoopParams && actualFn._jsoopParams[i];
         if (p && typeof p === 'object') {
           for (const k in p) {
             try {
               const parsed = JSON.parse(k);
               if (parsed == paramNames[i]) { def = p[k]; break; }
             } catch (_) {
               if (k == paramNames[i] || k == ('"' + paramNames[i] + '"') || k == rawName) { def = p[k]; break; }
             }
           }
         }
         if (isSpread) {
           const remainder = Array.isArray(args) ? args.slice(i) : [];
           if (vm && vm.runtime && vm.runtime.ext_jsoop && vm.runtime.ext_jsoop.settings && vm.runtime.ext_jsoop.settings.automaticSpreadArgInClassArgsObjectToJwArrayConversion !== false) {
             clonedThread.jsoopArgs[String(name)] = new vm.jwArray.Type((remainder || []).map(function(item){ try { return (vm && vm.runtime && vm.runtime.ext_jsoop && typeof vm.runtime.ext_jsoop._convertToNativeValue === 'function') ? vm.runtime.ext_jsoop._convertToNativeValue(item) : item; } catch(e) { return item; } }));
           } else {
             clonedThread.jsoopArgs[String(name)] = remainder;
           }
           break;
         } else {
           clonedThread.jsoopArgs[String(name)] = (i < args.length && typeof args[i] !== 'undefined') ? args[i] : def;
         }
       }
       if (vm.runtime.ext_jsoop.settings.automaticClassMethodCallArgsObjectToDogeiscutObject) clonedThread.jsoopArgs = new vm.dogeiscutObject.Type(clonedThread.jsoopArgs);
       try { actualFunc._jsoopOwnerTarget = func; } catch (_) {}
      const result = yield* waitPromise(vm.runtime.ext_jsoop._invokeJsoopFactory(actualFunc, target, clonedThread, args));
      return result;
     }
     const result = actualFunc.apply(target, actualFunc && actualFunc._jsoopMethod ? [thread].concat(args) : args);
     if (result && typeof result.next === 'function') return yield* result;
     if (result && typeof result.then === 'function') {
       return yield* waitPromise(result);
     }
     return result;
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
      try { if (vm && vm.runtime && vm.runtime.ext_jsoop && vm.runtime.ext_jsoop.settings && vm.runtime.ext_jsoop.settings.automaticArgArrayToNativeConversion !== false) { args = args.map(function(item){ try { return vm.runtime.ext_jsoop._convertToNativeValue(item); } catch(e) { return item; } }); } } catch(e) {}
    if (actualFunc && actualFunc._jsoopFactory) {
       const clonedThread = thread //typeof thread !== 'undefined' && thread && typeof thread.clone === 'function' ? thread.clone() : thread;
      if (!clonedThread) return undefined;

       clonedThread.jsoopArgs = {};
       clonedThread._jsoopCallerTarget = target;
       clonedThread._jsoopMethodTarget = __target;
       window.fooo = actualFn._jsoopParams;
       const paramNames = Array.isArray(actualFn._jsoopParams)
         ? actualFn._jsoopParams.map(function(p) {
             try {
               var obj = p;
               if (obj && typeof obj === 'object' && obj._jsoopLookupMarker && obj.lookupId) {
                 obj = vm.runtime.ext_jsoop._getFromLookupTable(obj.lookupId);
                 if (obj instanceof vm.runtime.ext_jsoop.JSObject) obj = obj.value;
               } else if (obj instanceof vm.runtime.ext_jsoop.JSObject) {
                 obj = obj.value;
               }
               if (typeof obj === 'string') return obj;
               if (obj && typeof obj === 'object') {
                 const keys = Object.keys(obj);
                 if (keys.length) {
                   const key = keys[0];
                   try { return JSON.parse(key); } catch (_) { return key; }
                 }
               }
               return null;
             } catch (e) { return null; }
           })
         : [];
       for (let i = 0; i < paramNames.length; i++) {
         var rawName = null;
         try {
           const p = actualFn._jsoopParams && actualFn._jsoopParams[i];
           let obj = p;
           if (obj && typeof obj === 'object' && obj._jsoopLookupMarker && obj.lookupId) {
             obj = vm.runtime.ext_jsoop._getFromLookupTable(obj.lookupId);
             if (obj instanceof vm.runtime.ext_jsoop.JSObject) obj = obj.value;
           } else if (obj instanceof vm.runtime.ext_jsoop.JSObject) {
             obj = obj.value;
           }
           if (typeof obj === 'string') rawName = obj;
           else if (obj && typeof obj === 'object') {
             const keys = Object.keys(obj);
             if (keys.length) {
               try { rawName = JSON.parse(keys[0]); } catch (_) { rawName = keys[0]; }
             }
           }
         } catch (_) { rawName = null; }
         if (rawName == null) rawName = (paramNames[i] == null ? i : paramNames[i]);
         var isSpread = false;
         var name = rawName;
         if (typeof name === 'string' && name.trim().startsWith('...')) {
           isSpread = true;
           name = name.replace(/^\s*\.{3}/, '');
         }
         var def;
         const p = actualFn._jsoopParams && actualFn._jsoopParams[i];
         if (p && typeof p === 'object') {
           for (const k in p) {
             try {
               const parsed = JSON.parse(k);
               if (parsed == paramNames[i]) { def = p[k]; break; }
             } catch (_) {
               if (k == paramNames[i] || k == ('"' + paramNames[i] + '"') || k == rawName) { def = p[k]; break; }
             }
           }
         }
         if (isSpread) {
           const remainder = Array.isArray(args) ? args.slice(i) : [];
           if (vm && vm.runtime && vm.runtime.ext_jsoop && vm.runtime.ext_jsoop.settings && vm.runtime.ext_jsoop.settings.automaticSpreadArgInClassArgsObjectToJwArrayConversion !== false) {
             clonedThread.jsoopArgs[String(name)] = new vm.jwArray.Type((remainder || []).map(function(item){ try { return (vm && vm.runtime && vm.runtime.ext_jsoop && typeof vm.runtime.ext_jsoop._convertToNativeValue === 'function') ? vm.runtime.ext_jsoop._convertToNativeValue(item) : item; } catch(e) { return item; } }));
           } else {
             clonedThread.jsoopArgs[String(name)] = remainder;
           }
           break;
         } else {
           clonedThread.jsoopArgs[String(name)] = (i < args.length && typeof args[i] !== 'undefined') ? args[i] : def;
         }
       }
       if (vm.runtime.ext_jsoop.settings.automaticClassMethodCallArgsObjectToDogeiscutObject) clonedThread.jsoopArgs = new vm.dogeiscutObject.Type(clonedThread.jsoopArgs);
       try { actualFunc._jsoopOwnerTarget = func; } catch (_) {}
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
                    setSetting: (node, compiler, imports) => {
                        const settingExpr = node.SETTING.toString();
                        const valueExpr = compiler
                            .descendInput(node.VALUE)
                            .asUnknown();
                        const map = {
                            "Automatic arg array to native conversion":
                                "automaticArgArrayToNativeConversion",
                            "Automatic class method call args object to dogeiscutObject conversion":
                                "automaticClassMethodCallArgsObjectToDogeiscutObject", // <-- ADD THIS
                            "Automatic spread arg in class args object to jwArray conversion":
                                "automaticSpreadArgInClassArgsObjectToJwArrayConversion",
                            "Prefer compiled class-arg stack":
                                "preferCompiledClassArgStack",
                            "Wrap new instances in JSObject":
                                "wrapNewInstances",
                            "Enable debug logging": "enableDebugLogging",
                            "Use lookup table by default":
                                "useLookupTableByDefault",
                        };
                        compiler.source += `try { const s = ${JSON.stringify(settingExpr)}; const v = !!(${valueExpr}); const _map = ${JSON.stringify(
                            map,
                        )}; const key = _map[s] || s; try { if (vm && vm.runtime && vm.runtime.ext_jsoop) { vm.runtime.ext_jsoop.settings = vm.runtime.ext_jsoop.settings || {}; vm.runtime.ext_jsoop.settings[key] = !!v; console.log(vm.runtime.ext_jsoop.settings[key]); if (key === 'useLookupTableByDefault') try { vm.runtime.ext_jsoop._lookupTableEnabled = !!v; } catch(_) {} if (key === 'enableDebugLogging') try { DEBUG = !!v; } catch(_) {} } } catch(_) {} } catch(_) {}
`;
                    },
                    // Compile-time getter for properties — emit inline compiled code
                    getProp: (node, compiler, imports) => {
                        const propExpr = compiler
                            .descendInput(node.PROP)
                            .asString();
                        const instanceExpr = compiler
                            .descendInput(node.INSTANCE)
                            .asUnknown();
                        const src = `(() => {
  try {
    const _inst = ${instanceExpr};
    let _holder = null;
    let _target;
    if (_inst instanceof vm.runtime.ext_jsoop.JSObject) { _holder = _inst; _target = _inst.value; }
    else if (_inst && typeof _inst === 'object' && _inst._jsoopLookupMarker && _inst.lookupId) {
      let _found = vm.runtime.ext_jsoop._getFromLookupTable(_inst.lookupId);
      if (_found instanceof vm.runtime.ext_jsoop.JSObject) { _holder = _found; _target = _found.value; } else { _target = _found; }
    } else { _target = _inst; }
    const _val = _target != null ? _target[${propExpr}] : undefined;
    if (_val !== null && _val !== undefined && (typeof _val === 'object' || typeof _val === 'function')) {
      try {
        const _jsobj = new vm.runtime.ext_jsoop.JSObject(_val);
        return vm.runtime.ext_jsoop._storeInLookupTable(_jsobj);
      } catch (_) {
        try { return vm.runtime.ext_jsoop._wrapForOtherExtensions(vm.runtime.ext_jsoop.JSObject.toType(_val)); } catch (_) { return vm.runtime.ext_jsoop.JSObject.toType(_val); }
      }
    }
    try { return vm.runtime.ext_jsoop._convertToNativeValue(_val); } catch (_) { return _val; }
  } catch (e) {
    return "[Error: " + String(e) + "]";
  }
})()`;
                        return new imports.TypedInput(
                            src,
                            imports.TYPE_UNKNOWN,
                        );
                    },
                    // Compile-time setters: emit inline compiled code matching runtime logic
                    setPropString: (node, compiler, imports) => {
                        const propExpr = compiler
                            .descendInput(node.PROP)
                            .asString();
                        const instanceExpr = compiler
                            .descendInput(node.INSTANCE)
                            .asUnknown();
                        const valueExpr = compiler
                            .descendInput(node.VALUE)
                            .asUnknown();
                        compiler.source += `try {
  const _inst = ${instanceExpr};
  let _holder = null;
  let _target;
  if (_inst instanceof vm.runtime.ext_jsoop.JSObject) { _holder = _inst; _target = _inst.value; }
  else if (_inst && typeof _inst === 'object' && _inst._jsoopLookupMarker && _inst.lookupId) {
    let _found = vm.runtime.ext_jsoop._getFromLookupTable(_inst.lookupId);
    if (_found instanceof vm.runtime.ext_jsoop.JSObject) { _holder = _found; _target = _found.value; } else { _target = _found; }
  } else { _target = _inst; }
  let parsed;
  try { parsed = JSON.parse(${valueExpr}); } catch {
    const t = ${valueExpr} && ${valueExpr}.trim();
    if (/^-?\\d+(\\.\\d+)?$/.test(t)) parsed = Number(t);
    else if (t === "true") parsed = true;
    else if (t === "false") parsed = false;
    else parsed = ${valueExpr};
  }
  if (_target && (typeof _target === 'object' || typeof _target === 'function')) {
    _target[${propExpr}] = parsed;
  } else {
    const _newObj = Object(_target);
    _newObj[${propExpr}] = parsed;
    if (_holder) _holder.value = _newObj;
    else if (_inst && typeof _inst === 'object') _inst.value = _newObj;
  }
} catch (e) { try { console.error(e); } catch(_) {} }
`;
                    },
                    setPropJSObject: (node, compiler, imports) => {
                        const propExpr = compiler
                            .descendInput(node.PROP)
                            .asString();
                        const instanceExpr = compiler
                            .descendInput(node.INSTANCE)
                            .asUnknown();
                        const valueExpr = compiler
                            .descendInput(node.VALUE)
                            .asUnknown();
                        compiler.source += `try {
  const _inst = ${instanceExpr};
  let _holder = null;
  let _target;
  if (_inst instanceof vm.runtime.ext_jsoop.JSObject) { _holder = _inst; _target = _inst.value; }
  else if (_inst && typeof _inst === 'object' && _inst._jsoopLookupMarker && _inst.lookupId) {
    let _found = vm.runtime.ext_jsoop._getFromLookupTable(_inst.lookupId);
    if (_found instanceof vm.runtime.ext_jsoop.JSObject) { _holder = _found; _target = _found.value; } else { _target = _found; }
  } else { _target = _inst; }
  let _val = ${valueExpr};
  if (!(_val instanceof vm.runtime.ext_jsoop.JSObject) && !(_val && typeof _val === 'object' && (_val._jsoopLookupMarker || _val.customId))) {
    try { _val = vm.runtime.ext_jsoop._convertToNativeValue(${valueExpr}); } catch (_) { _val = ${valueExpr}; }
  }
  if (_target && (typeof _target === 'object' || typeof _target === 'function')) {
    _target[${propExpr}] = _val;
  } else {
    const _newObj = Object(_target);
    _newObj[${propExpr}] = _val;
    if (_holder) _holder.value = _newObj;
    else if (_inst && typeof _inst === 'object') _inst.value = _newObj;
  }
} catch (e) { try { console.error(e); } catch(_) {} }
`;
                    },
                    setPropJwArray: (node, compiler, imports) => {
                        const propExpr = compiler
                            .descendInput(node.PROP)
                            .asString();
                        const instanceExpr = compiler
                            .descendInput(node.INSTANCE)
                            .asUnknown();
                        const valueExpr = compiler
                            .descendInput(node.VALUE)
                            .asUnknown();
                        compiler.source += `try {
  const _inst = ${instanceExpr};
  let _holder = null;
  let _target;
  if (_inst instanceof vm.runtime.ext_jsoop.JSObject) { _holder = _inst; _target = _inst.value; }
  else if (_inst && typeof _inst === 'object' && _inst._jsoopLookupMarker && _inst.lookupId) {
    let _found = vm.runtime.ext_jsoop._getFromLookupTable(_inst.lookupId);
    if (_found instanceof vm.runtime.ext_jsoop.JSObject) { _holder = _found; _target = _found.value; } else { _target = _found; }
  } else { _target = _inst; }
  let _val = ${valueExpr};
  console.log(_val);
  if (!(_val instanceof vm.runtime.ext_jsoop.JSObject) && !(_val && typeof _val === 'object' && (_val._jsoopLookupMarker || _val.customId))) {
    try { _val = vm.runtime.ext_jsoop._convertToNativeValue(${valueExpr}); } catch (_) { _val = ${valueExpr}; }
  }
    
  if (_target && _target instanceof vm.jwArray.Type) {
    _target.array[${propExpr}] = _val;
  } else if (_inst && _inst.customId === 'jwArray' && _inst.array) {
    _inst.array[${propExpr}] = _val;
  } else if (_target && (typeof _target === 'object' || typeof _target === 'function')) {
    _target[${propExpr}] = _val;
  } else {
    const _newObj = Object(_target);
    _newObj[${propExpr}] = _val;
    if (_holder) _holder.value = _newObj;
    else if (_inst && typeof _inst === 'object') _inst.value = _newObj;
  }
} catch (e) { try { console.error(e); } catch(_) {} }
`;
                    },
                    setPropDogeiscutObject: (node, compiler, imports) => {
                        const propExpr = compiler
                            .descendInput(node.PROP)
                            .asString();
                        const instanceExpr = compiler
                            .descendInput(node.INSTANCE)
                            .asUnknown();
                        const valueExpr = compiler
                            .descendInput(node.VALUE)
                            .asUnknown();
                        compiler.source += `try {
  const _inst = ${instanceExpr};
  let _holder = null;
  let _target;
  if (_inst instanceof vm.runtime.ext_jsoop.JSObject) { _holder = _inst; _target = _inst.value; }
  else if (_inst && typeof _inst === 'object' && _inst._jsoopLookupMarker && _inst.lookupId) {
    let _found = vm.runtime.ext_jsoop._getFromLookupTable(_inst.lookupId);
    if (_found instanceof vm.runtime.ext_jsoop.JSObject) { _holder = _found; _target = _found.value; } else { _target = _found; }
  } else { _target = _inst; }
  let _val = ${valueExpr};
  if (!(_val instanceof vm.runtime.ext_jsoop.JSObject) && !(_val && typeof _val === 'object' && (_val._jsoopLookupMarker || _val.customId))) {
    try { _val = vm.runtime.ext_jsoop._convertToNativeValue(${valueExpr}); } catch (_) { _val = ${valueExpr}; }
  }
  if (_target && _target.customId === 'dogeiscutObject' && Array.isArray(_target.map)) {
    let found = false;
    for (let i = 0; i < _target.map.length; i++) {
      if (_target.map[i][0] === ${propExpr}) {
        _target.map[i][1] = _val;
        found = true;
        break;
      }
    }
    if (!found) _target.map.push([${propExpr}, _val]);
  } else if (_inst && _inst.customId === 'dogeiscutObject' && Array.isArray(_inst.map)) {
    let found = false;
    for (let i = 0; i < _inst.map.length; i++) {
      if (_inst.map[i][0] === ${propExpr}) {
        _inst.map[i][1] = _val;
        found = true;
        break;
      }
    }
    if (!found) _inst.map.push([${propExpr}, _val]);
  } else if (_target && (typeof _target === 'object' || typeof _target === 'function')) {
    _target[${propExpr}] = _val;
  } else {
    const _newObj = Object(_target);
    _newObj[${propExpr}] = _val;
    if (_holder) _holder.value = _newObj;
    else if (_inst && typeof _inst === 'object') _inst.value = _newObj;
  }
} catch (e) { try { console.error(e); } catch(_) {} }
`;
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
                // Respect runtime setting to optionally skip automatic conversion
                if (
                    this.settings &&
                    this.settings.automaticArgArrayToNativeConversion === false
                ) {
                    return jwArrayObj.array.slice();
                }
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

        async new({ CONSTRUCTOR, ARGS }) {
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
                    // If constructor ran a factory that returned an initialization
                    // promise, wait for it to complete so methods and instance state
                    // are ready before returning to caller.
                    try {
                        if (
                            instance &&
                            instance._jsoopInitPromise &&
                            typeof instance._jsoopInitPromise.then ===
                                "function"
                        ) {
                            await instance._jsoopInitPromise;
                        }
                    } catch (_) {}
                    if (DEBUG)
                        console.dir({
                            action: "new(result)",
                            instance,
                        });
                    // Respect runtime setting whether to wrap new instances
                    if (this.settings && this.settings.wrapNewInstances) {
                        const result = JSObject.toType(instance);
                        return this._wrapForOtherExtensions(
                            this._convertResultToJwArray(result),
                        );
                    }
                    return instance;
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
                        return result;
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
                        return result;
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
                return result;
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
                            return awaited;
                        }
                        if (DEBUG)
                            console.dir({
                                action: "awaitCallMethod(resultPrimitive)",
                                res,
                            });
                        return res;
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
                    return awaited;
                }
                if (DEBUG)
                    console.dir({
                        action: "awaitCallMethod(result)",
                        result,
                    });
                return result;
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

                return result;
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

                return result;
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

        setSetting({ SETTING, VALUE }) {
            if (DEBUG)
                console.dir({
                    action: "setSetting(entry)",
                    SETTING,
                    VALUE,
                });
            try {
                const map = {
                    "Automatic arg array to native conversion":
                        "automaticArgArrayToNativeConversion",
                    "Automatic class method call args object to dogeiscutObject conversion":
                        "automaticClassMethodCallArgsObjectToDogeiscutObject", // <-- ADD THIS
                    "Automatic spread arg in class args object to jwArray conversion":
                        "automaticSpreadArgInClassArgsObjectToJwArrayConversion",
                    "Prefer compiled class-arg stack":
                        "preferCompiledClassArgStack",
                    "Wrap new instances in JSObject": "wrapNewInstances",
                    "Enable debug logging": "enableDebugLogging",
                    "Use lookup table by default": "useLookupTableByDefault",
                };
                const key = map[SETTING] || String(SETTING);
                const val = !!VALUE;
                this.settings = this.settings || {};
                this.settings[key] = val;
                if (key === "enableDebugLogging") {
                    try {
                        DEBUG = !!val;
                    } catch (_) {}
                }
                if (key === "useLookupTableByDefault") {
                    try {
                        this._lookupTableEnabled = !!val;
                    } catch (_) {}
                }
                if (DEBUG)
                    console.dir({
                        action: "setSetting(done)",
                        key,
                        val,
                        settings: this.settings,
                    });
            } catch (err) {
                console.error("JS OOP Error in setSetting:", err);
                if (DEBUG)
                    console.dir({
                        action: "setSetting(error)",
                        error: err,
                    });
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

            // Quick diagnostics to understand the incoming VALUE shape
            try {
                const isJwArrayRaw =
                    typeof jwArray !== "undefined" &&
                    jwArray &&
                    VALUE instanceof jwArray.Type;
                const isJSObjectRaw = VALUE instanceof JSObject;
                const isLookupMarker =
                    VALUE &&
                    typeof VALUE === "object" &&
                    (VALUE._jsoopLookupMarker || VALUE.lookupId);
                const isArrayRaw = Array.isArray(VALUE);
                const preview = (() => {
                    try {
                        return VALUE && VALUE.toString
                            ? VALUE.toString()
                            : String(VALUE);
                    } catch (e) {
                        return String(VALUE);
                    }
                })();
                console.log("[jsoop.debug] setPropJwArray incoming:", {
                    PROP,
                    isArrayRaw,
                    isJwArrayRaw,
                    isJSObjectRaw,
                    isLookupMarker,
                    preview,
                });
            } catch (e) {
                try {
                    console.error(
                        "[jsoop.debug] setPropJwArray diag failed",
                        e,
                    );
                } catch (_) {}
            }

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
                if (DEBUG)
                    console.dir({ action: "setPropJwArray(converted)", value });
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
                console.dir({
                    action: "setPropJwArray(done)",
                    PROP,
                    target: holder ? holder.value : target,
                    assignedValue: value,
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

        // Runtime compatibility stubs for args-builder stack blocks.
        // These ensure compatibility-layer execution doesn't error when the
        // compiled environment isn't active. They push arg descriptors onto
        // `thread._jsoopArgsStack` similarly to the compile-time generator.
        classArgStack({ NAME }, util) {
            try {
                const thread = util.thread;
                if (!thread) return;
                thread._jsoopArgsStack ??= [];
                const topArgs =
                    thread._jsoopArgsStack[thread._jsoopArgsStack.length - 1];
                if (topArgs)
                    topArgs.push(
                        new this.JSObject({ [String(NAME)]: undefined }),
                    );
            } catch (_) {}
        }
        classArgStringStack({ NAME, DEFAULT }, util) {
            try {
                const thread = util.thread;
                if (!thread) return;
                thread._jsoopArgsStack ??= [];
                const topArgs =
                    thread._jsoopArgsStack[thread._jsoopArgsStack.length - 1];
                if (topArgs)
                    topArgs.push(
                        this._storeClassArgDefault({ [String(NAME)]: DEFAULT }),
                    );
            } catch (_) {}
        }
        classArgNumberStack({ NAME, DEFAULT }, util) {
            try {
                const thread = util.thread;
                if (!thread) return;
                thread._jsoopArgsStack ??= [];
                const topArgs =
                    thread._jsoopArgsStack[thread._jsoopArgsStack.length - 1];
                if (topArgs)
                    topArgs.push(
                        this._storeClassArgDefault({ [String(NAME)]: DEFAULT }),
                    );
            } catch (_) {}
        }
        classArgDogeiscutObjectStack({ NAME, DEFAULT }, util) {
            try {
                const thread = util.thread;
                if (!thread) return;
                thread._jsoopArgsStack ??= [];
                const topArgs =
                    thread._jsoopArgsStack[thread._jsoopArgsStack.length - 1];
                if (topArgs)
                    topArgs.push(
                        this._storeClassArgDefault({ [String(NAME)]: DEFAULT }),
                    );
            } catch (_) {}
        }
        classArgJwArrayStack({ NAME, DEFAULT }, util) {
            try {
                const thread = util.thread;
                if (!thread) return;
                thread._jsoopArgsStack ??= [];
                const topArgs =
                    thread._jsoopArgsStack[thread._jsoopArgsStack.length - 1];
                if (topArgs)
                    topArgs.push(
                        this._storeClassArgDefault({ [String(NAME)]: DEFAULT }),
                    );
            } catch (_) {}
        }
        classArgJSObjectStack({ NAME, DEFAULT }, util) {
            try {
                const thread = util.thread;
                if (!thread) return;
                thread._jsoopArgsStack ??= [];
                const topArgs =
                    thread._jsoopArgsStack[thread._jsoopArgsStack.length - 1];
                if (topArgs)
                    topArgs.push(
                        this._storeClassArgDefault({ [String(NAME)]: DEFAULT }),
                    );
            } catch (_) {}
        }
        classArgDefaultStack({ NAME, DEFAULT }, util) {
            try {
                const thread = util.thread;
                if (!thread) return;
                thread._jsoopArgsStack ??= [];
                const topArgs =
                    thread._jsoopArgsStack[thread._jsoopArgsStack.length - 1];
                if (topArgs)
                    topArgs.push(
                        this._storeClassArgDefault({ [String(NAME)]: DEFAULT }),
                    );
            } catch (_) {}
        }
        classArgSpreadStack({ NAME }, util) {
            try {
                const thread = util.thread;
                if (!thread) return;
                thread._jsoopArgsStack ??= [];
                const topArgs =
                    thread._jsoopArgsStack[thread._jsoopArgsStack.length - 1];
                if (topArgs)
                    topArgs.push(
                        new this.JSObject({
                            ["..." + String(NAME)]: undefined,
                        }),
                    );
            } catch (_) {}
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
