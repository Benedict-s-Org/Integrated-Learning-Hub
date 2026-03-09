const fs = require('fs');

const file = './src/components/GlobalDiagnosticPanel/GlobalDiagnosticPanel.tsx';
let content = fs.readFileSync(file, 'utf8');

const markerStart = '{/* Component Color Editor */}';
const markerEnd = '{!errorDetails && !isRunningChecks && checks.length > 0 && checks.every(c => c.status === \'passed\') && (';

let idxStart = content.indexOf(markerStart);
let idxEnd = content.indexOf(markerEnd);

if (idxStart !== -1 && idxEnd !== -1) {
    let block = content.substring(idxStart, idxEnd);
    content = content.replace(block, '');
    
    // find end of isEnabled block
    const target = '            </>\n          )}\n        </div>\n      </div>\n    </div>';
    
    let replacement = `            </>\n          )}\n\n          ${block}\n        </div>\n      </div>\n    </div>`;
    
    content = content.replace(target, replacement);
    fs.writeFileSync(file, content);
    console.log("SUCCESS");
} else {
    console.log("FAILED");
}
