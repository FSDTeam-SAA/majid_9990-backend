import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

const projectRoot = process.cwd();
const swaggerOutputPath = path.resolve(projectRoot, 'swagger-output.json');
const sourceRoot = path.resolve(projectRoot, 'src');

type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

type RouteEntry = {
      method: HttpMethod;
      path: string;
      tag: string;
      summary: string;
      description: string;
      parameters?: Array<{
            name: string;
            in: 'path' | 'query' | 'header';
            required?: boolean;
            schema?: { type: string };
      }>;
};

const toPosixRelativePath = (absolutePath: string) =>
      path.relative(projectRoot, absolutePath).split(path.sep).join('/');

const cleanPathSegment = (segment: string) => segment.replace(/^\/+|\/+$/g, '');

const toTagLabel = (segment: string) => {
      const normalized = cleanPathSegment(segment);

      if (!normalized) {
            return 'General';
      }

      if (normalized.toLowerCase() === 'imei') {
            return 'IMEI';
      }

      return normalized
            .split('-')
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ');
};

const joinPaths = (basePath: string, routePath: string) => {
      const normalizedBase = cleanPathSegment(basePath);
      const normalizedRoute = cleanPathSegment(routePath);

      const segments = [normalizedBase, normalizedRoute].filter(Boolean);

      return `/${segments.join('/')}`.replace(/\/+/g, '/');
};

const extractPathParameters = (routePath: string) =>
      [...routePath.matchAll(/:(\w+)/g)].map((match) => ({
            name: match[1],
            in: 'path' as const,
            required: true,
            schema: { type: 'string' },
      }));

const extractBodyFieldsFromController = async (controllerPath: string, handlerName: string) => {
      try {
            const src = await fsp.readFile(controllerPath, 'utf8');

            // find position of handlerName in file
            const idx = src.indexOf(handlerName);
            const searchWindow = idx >= 0 ? src.slice(Math.max(0, idx - 200), Math.min(src.length, idx + 2000)) : src;

            const fields = new Set<string>();

            // destructured: const { a, b } = req.body
            for (const m of searchWindow.matchAll(/const\s*\{([^}]+)\}\s*=\s*req\.body/g)) {
                  const list = m[1]
                        .split(',')
                        .map((s) => s.trim().split(':')[0].trim())
                        .filter(Boolean);
                  for (const f of list) fields.add(f);
            }

            // property access: req.body.foo
            for (const m of searchWindow.matchAll(/req\.body\.([A-Za-z0-9_]+)/g)) {
                  fields.add(m[1]);
            }

            // bracket access: req.body['foo'] or req.body["foo"]
            for (const m of searchWindow.matchAll(/req\.body\[['"]([^'"\]]+)['"]\]/g)) {
                  fields.add(m[1]);
            }

            return Array.from(fields);
      } catch {
            return [];
      }
};

const extractModelFieldsFromModule = async (routeFilePath: string) => {
      try {
            const moduleDir = path.dirname(routeFilePath);
            const entries = fs.readdirSync(moduleDir, { withFileTypes: true });
            const modelFiles = entries
                  .filter((e) => e.isFile() && e.name.endsWith('.model.ts'))
                  .map((e) => path.join(moduleDir, e.name));

            const fields: Array<{ name: string; type: string }> = [];

            for (const mf of modelFiles) {
                  const src = await fsp.readFile(mf, 'utf8');

                  const schemaPos = src.indexOf('new Schema');
                  if (schemaPos === -1) continue;

                  const openParen = src.indexOf('(', schemaPos);
                  if (openParen === -1) continue;

                  // find the first opening brace after the opening paren
                  const braceStart = src.indexOf('{', openParen);
                  if (braceStart === -1) continue;

                  // simple brace matching to find the object literal end
                  let depth = 0;
                  let i = braceStart;
                  let objText = '';
                  for (; i < src.length; i++) {
                        const ch = src[i];
                        objText += ch;
                        if (ch === '{') depth++;
                        else if (ch === '}') {
                              depth--;
                              if (depth === 0) break;
                        }
                  }

                  // extract top-level keys and attempt to infer simple types
                  for (const m of objText.matchAll(/['"]?([A-Za-z0-9_]+)['"]?\s*:\s*(\{[^}]*\}|[^,\n]+)/g)) {
                        const key = m[1];
                        const rest = m[2] || '';

                        // attempt to find a `type:` token inside the property's object
                        let inferred = 'string';

                        const typeMatch = rest.match(/type\s*:\s*([^,\n}]+)/);
                        if (typeMatch) {
                              const rawType = typeMatch[1].trim();
                              if (/Number\b/.test(rawType)) inferred = 'number';
                              else if (/Boolean\b/.test(rawType)) inferred = 'boolean';
                              else if (/Date\b/.test(rawType)) inferred = 'string';
                              else if (/Schema\.Types\.ObjectId/.test(rawType)) inferred = 'string';
                              else if (/\[/.test(rawType)) inferred = 'array';
                              else inferred = 'string';
                        } else {
                              // fallback heuristics
                              if (/quantity|count|total|price|amount/i.test(key)) inferred = 'number';
                              else if (/is|has|active|enabled/i.test(key)) inferred = 'boolean';
                              else inferred = 'string';
                        }

                        fields.push({ name: key, type: inferred });
                  }
            }

            return fields;
      } catch {
            return [];
      }
};

const collectRouteFiles = (directoryPath: string): string[] => {
      if (!fs.existsSync(directoryPath)) {
            return [];
      }

      const entries = fs.readdirSync(directoryPath, { withFileTypes: true });
      const routeFiles: string[] = [];

      for (const entry of entries) {
            const entryPath = path.join(directoryPath, entry.name);

            if (entry.isDirectory()) {
                  routeFiles.push(...collectRouteFiles(entryPath));
                  continue;
            }

            if (/(\.router\.ts|\.routes\.ts)$/.test(entry.name)) {
                  routeFiles.push(entryPath);
            }
      }

      return routeFiles;
};

const routeIndexPath = path.resolve(sourceRoot, 'routes/index.ts');
const routeFilePaths = collectRouteFiles(path.resolve(sourceRoot, 'modules'));

const parseMountedRoutes = async () => {
      const routeIndexSource = await fsp.readFile(routeIndexPath, 'utf8');
      const importMap = new Map<string, string>();
      const routeIndexDirectory = path.dirname(routeIndexPath);

      for (const importMatch of routeIndexSource.matchAll(
            /import\s+(\w+)\s+from\s+['"](\.\.\/modules\/[^'"]+)['"];?/g
      )) {
            const variableName = importMatch[1];
            const importPath = importMatch[2];
            const absolutePath = path.resolve(routeIndexDirectory, importPath);

            importMap.set(variableName, absolutePath.endsWith('.ts') ? absolutePath : `${absolutePath}.ts`);
      }

      const mountedRoutes = new Map<string, string[]>();

      for (const routeMatch of routeIndexSource.matchAll(
            /\{\s*path:\s*['"]([^'"]+)['"],\s*route:\s*(\w+)\s*,?\s*\}/g
      )) {
            const mountPath = routeMatch[1];
            const routeVariable = routeMatch[2];
            const routeFilePath = importMap.get(routeVariable);

            if (!routeFilePath) {
                  continue;
            }

            const existingMounts = mountedRoutes.get(routeFilePath) ?? [];
            existingMounts.push(mountPath);
            mountedRoutes.set(routeFilePath, existingMounts);
      }

      return mountedRoutes;
};

const parseRouteFile = async (routeFilePath: string, mounts: string[]): Promise<RouteEntry[]> => {
      const source = await fsp.readFile(routeFilePath, 'utf8');
      const tag = toTagLabel(path.basename(path.dirname(routeFilePath)));
      const entries: RouteEntry[] = [];

      // build import map for this router file to resolve controller files
      const importMap = new Map<string, string>();
      for (const im of source.matchAll(/import\s+(\w+)\s+from\s+['"](.+?)['"];?/g)) {
            const varName = im[1];
            const importPath = im[2];
            const absolute = path.resolve(path.dirname(routeFilePath), importPath.replace(/\.ts$/, ''));
            const candidate = absolute.endsWith('.ts') ? absolute : `${absolute}.ts`;
            importMap.set(varName, candidate);
      }

      for (const match of source.matchAll(/router\.(get|post|put|patch|delete)\(\s*(['"])(.*?)\2/g)) {
            const method = match[1].toLowerCase() as HttpMethod;
            const routePath = match[3];
            const parameters = extractPathParameters(routePath);

            // try to extract the handler name from the full call (between this match and the next ");")
            const startIndex = match.index ?? 0;
            const endIndex = source.indexOf(');', startIndex);
            const callSnippet =
                  endIndex > startIndex
                        ? source.slice(startIndex, endIndex)
                        : source.slice(startIndex, startIndex + 200);

            let handlerToken: string | undefined;
            // find the last comma-separated token which should be the handler reference
            const afterComma = callSnippet
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean);
            if (afterComma.length > 0) {
                  handlerToken = afterComma[afterComma.length - 1];
            }

            let inferredRequestBody: Record<string, unknown> | undefined = undefined;

            if (handlerToken) {
                  // clean possible trailing parentheses or middleware wrappers
                  handlerToken = handlerToken.replace(/\)+$/g, '').replace(/\s*$/g, '');

                  // handlerToken may be controller.method or just method
                  const parts = handlerToken.split('.').map((p) => p.trim());
                  let handlerName = parts[parts.length - 1];
                  let controllerVar = parts.length > 1 ? parts[0] : undefined;

                  if (controllerVar && importMap.has(controllerVar)) {
                        const controllerPath = importMap.get(controllerVar)!;
                        const bodyFields = await extractBodyFieldsFromController(controllerPath, handlerName).catch(
                              () => []
                        );
                        if (bodyFields.length > 0) {
                              inferredRequestBody = {
                                    content: {
                                          'application/json': {
                                                schema: {
                                                      type: 'object',
                                                      properties: Object.fromEntries(
                                                            bodyFields.map((f: string) => [f, { type: 'string' }])
                                                      ),
                                                },
                                          },
                                    },
                              };
                        }
                  }

                  // if we couldn't infer from controller, try to infer from module model files
                  if (!inferredRequestBody) {
                        const modelFields = await extractModelFieldsFromModule(routeFilePath).catch(() => []);
                        if (modelFields.length > 0) {
                              inferredRequestBody = {
                                    content: {
                                          'application/json': {
                                                schema: {
                                                      type: 'object',
                                                      properties: Object.fromEntries(
                                                            modelFields.map((f: { name: string; type: string }) => {
                                                                  if (f.type === 'array')
                                                                        return [
                                                                              f.name,
                                                                              {
                                                                                    type: 'array',
                                                                                    items: { type: 'string' },
                                                                              },
                                                                        ];
                                                                  return [f.name, { type: f.type }];
                                                            })
                                                      ),
                                                },
                                          },
                                    },
                              };
                        }
                  }
            }

            for (const mountPath of mounts) {
                  const fullPath = joinPaths(mountPath, routePath);

                  entries.push({
                        method,
                        path: fullPath,
                        tag,
                        summary: `${method.toUpperCase()} ${fullPath}`,
                        description: `Auto-generated from ${toPosixRelativePath(routeFilePath)}.`,
                        parameters: parameters.length > 0 ? parameters : undefined,
                        // store requestBody info in description for later inclusion
                        // we'll include it in the final paths assembly
                        ...(inferredRequestBody ? { requestBody: inferredRequestBody } : {}),
                  });
            }
      }

      return entries;
};

const buildSwaggerDocument = async () => {
      const mountedRoutes = await parseMountedRoutes();
      const routeEntries = await Promise.all(
            routeFilePaths.map(async (routeFilePath) =>
                  parseRouteFile(routeFilePath, mountedRoutes.get(routeFilePath) ?? [])
            )
      );

      const operations = routeEntries.flat();
      const tags = Array.from(new Set(operations.map((operation) => operation.tag))).sort((left, right) =>
            left.localeCompare(right)
      );
      const paths: Record<string, Record<HttpMethod, unknown>> = {};

      for (const operation of operations) {
            if (!paths[operation.path]) {
                  paths[operation.path] = {} as Record<HttpMethod, unknown>;
            }

            const opObj: any = {
                  tags: [operation.tag],
                  summary: operation.summary,
                  description: operation.description,
                  parameters: operation.parameters,
                  responses: {
                        200: {
                              description: 'Successful response',
                        },
                        default: {
                              description: 'Error response',
                        },
                  },
            };

            if ((operation as any).requestBody) {
                  opObj.requestBody = (operation as any).requestBody;
            }

            // for write methods, ensure a requestBody is present so UI shows the body panel
            if (!opObj.requestBody && ['post', 'put', 'patch'].includes(operation.method)) {
                  opObj.requestBody = {
                        content: {
                              'application/json': {
                                    schema: { type: 'object' },
                              },
                        },
                  };
            }

            paths[operation.path][operation.method] = opObj;
      }

      return {
            openapi: '3.0.0',
            info: {
                  title: 'Majid 9990 Backend API',
                  description: 'Swagger documentation grouped by module routes.',
                  version: '1.0.0',
            },
            servers: [
                  {
                        url: '/api/v1',
                        description: 'API base path',
                  },
            ],
            tags: tags.map((name) => ({ name })),
            components: {
                  securitySchemes: {
                        bearerAuth: {
                              type: 'http',
                              scheme: 'bearer',
                              bearerFormat: 'JWT',
                        },
                  },
            },
            security: [{ bearerAuth: [] }],
            paths,
      };
};

export const ensureSwaggerSpec = async () => {
      const swaggerDocument = await buildSwaggerDocument();

      await fsp.writeFile(swaggerOutputPath, `${JSON.stringify(swaggerDocument, null, 2)}\n`, 'utf8');
};

export const loadSwaggerSpec = async () => {
      try {
            const content = await fsp.readFile(swaggerOutputPath, 'utf8');

            return JSON.parse(content);
      } catch {
            return buildSwaggerDocument();
      }
};

export { swaggerOutputPath };
