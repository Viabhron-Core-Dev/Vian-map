const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');
code = code.replace(
  `  </AnimatePresence>\n    </div>\n  );\n};\n\nexport default App;`,
  `  </AnimatePresence>\n\n  {new URLSearchParams(window.location.search).get('fromWidget') === 'true' && (\n    <div className="absolute bottom-[350px] right-4 z-[4000]">\n      <button \n        onClick={() => window.location.href = window.location.pathname + '?widget=true'}\n        className="w-11 h-11 bg-emerald-500 rounded-lg flex items-center justify-center text-white shadow-lg border border-emerald-400"\n        title="Back to Widget"\n      >\n        <MapIcon className="w-5 h-5" />\n      </button>\n    </div>\n  )}\n    </div>\n  );\n};\n\nexport default App;`
);
fs.writeFileSync('src/App.tsx', code);
