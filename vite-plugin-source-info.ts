import { Plugin } from 'vite';
import { transformSync } from '@babel/core';
import * as t from '@babel/types';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

export default function sourceInfoPlugin(): Plugin {
    return {
        name: 'vite-plugin-source-info',
        enforce: 'pre',
        transform(code, id) {
            if (!id.endsWith('.tsx') || id.includes('node_modules')) {
                return;
            }

            // Skip this file itself and other non-component files
            if (id.includes('vite.config') || id.includes('vite-plugin')) {
                return;
            }

            const result = transformSync(code, {
                filename: id,
                plugins: [
                    require.resolve('@babel/plugin-syntax-jsx'),
                    require.resolve('@babel/plugin-syntax-typescript'),
                    function () {
                        return {
                            visitor: {
                                JSXOpeningElement(path: any) {
                                    const node = path.node;

                                    // Only tag components (capitalized) or significant HTML elements
                                    // Skip fragments and simple wrappers if needed
                                    const nameObject = node.name;
                                    let tagName = '';

                                    if (t.isJSXIdentifier(nameObject)) {
                                        tagName = nameObject.name;
                                    } else if (t.isJSXMemberExpression(nameObject)) {
                                        tagName = `${(nameObject.object as any).name}.${(nameObject.property as any).name}`;
                                    }

                                    // Determine if we should tag this element
                                    const isComponent = /^[A-Z]/.test(tagName);
                                    const isSignificantElement = ['button', 'input', 'select', 'form', 'a', 'div', 'main', 'section', 'header', 'footer'].includes(tagName);

                                    if (isComponent || isSignificantElement) {
                                        // Check if already has data-source-tsx
                                        const hasSourceAttr = node.attributes.some((attr: any) =>
                                            t.isJSXAttribute(attr) && attr.name.name === 'data-source-tsx'
                                        );

                                        if (!hasSourceAttr && node.loc) {
                                            const line = node.loc.start.line;
                                            const relativePath = id.split('/src/').pop() || id; // Try to get path relative to src
                                            const sourceValue = `${tagName}|src/${relativePath}:${line}`;

                                            node.attributes.push(
                                                t.jsxAttribute(
                                                    t.jsxIdentifier('data-source-tsx'),
                                                    t.stringLiteral(sourceValue)
                                                )
                                            );
                                        }
                                    }
                                }
                            }
                        };
                    }
                ],
                configFile: false,
                babelrc: false,
            });

            return result?.code || null;
        }
    };
}
