'use strict';

const test = require('tape');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { diffString } = require('json-diff');

const listExports = require('list-exports');

const { OFFLINE, GREP, WRITE } = process.env;

const fixturesDir = path.join(__dirname, 'fixtures');
const fixtures = fs.readdirSync(fixturesDir);

const isOffline = !!OFFLINE;

const cli = path.join(__dirname, '..', 'ls-exports', 'bin', 'ls-exports');

const re = GREP && new RegExp(GREP);

test('listExports', (t) => {
	t.plan(fixtures.length);

	fixtures.forEach((fixture) => {
		const skip = re && !re.test(fixture);
		t.test(`fixture: ${fixture}`, { skip: skip }, async (st) => {
			const checkNPM = !isOffline && !fixture.startsWith('ex-') && fixture !== 'list-exports' && fixture !== 'ls-exports';
			st.plan(2 + (checkNPM ? 1 : 0));

			const fixtureDir = path.join(fixturesDir, fixture);
			const projectDir = path.join(fixtureDir, 'project');

			const expectedPath = path.join(fixtureDir, 'expected.json');
			const expected = JSON.parse(fs.readFileSync(expectedPath));
			const packageJSON = path.resolve(path.join(projectDir, 'package.json'));

			const results = await listExports(packageJSON)['catch']((e) => {
				console.error(e);
				throw e;
			});

			const diff = diffString(expected, results);
			if (diff) {
				console.error('# ' + diff.split('\n').join('\n# '));
			}
			st.deepEqual(results, expected, `${fixture}: API results match expectation`);
			if (WRITE) {
				fs.writeFileSync(expectedPath, JSON.stringify(results, null, '\t').trim() + '\n');
			}

			const cliResults = JSON.parse(execSync(`${cli} path "./${path.relative(process.cwd(), projectDir)}" --json`));
			st.deepEqual(cliResults, expected, `${fixture}: CLI results match expectation`);

			if (checkNPM) {
				const npmResults = JSON.parse(execSync(`${cli} package "${results.name}@${results.version}" --json`));
				const npmDiff = diffString(expected, npmResults);
				if (npmDiff) {
					console.error('# ' + npmDiff.split('\n').join('\n# '));
				}
				st.deepEqual(npmResults, expected, 'npm package results match expectation');
			}
		});
	});

	t.end();
});