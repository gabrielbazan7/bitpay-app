const fs = require('fs');
const os = require('os');
const path = require('path');
const {spawnSync} = require('child_process');

const root = path.resolve(__dirname, '../..');
const installed = path.join(root, 'node_modules/react-native-screens/cpp');
const compiler = process.env.CXX || 'clang++';
const compilerAvailable =
  spawnSync(compiler, ['--version'], {timeout: 5000}).status === 0;
const nativeTest = compilerAvailable ? it : it.skip;

nativeTest(
  'notifies only screens removed without a later insert of the same tag',
  () => {
    const directory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'screens-removal-listener-'),
    );
    try {
      for (const file of [
        'RNSScreenRemovalListener.cpp',
        'RNSScreenRemovalListener.h',
      ]) {
        fs.copyFileSync(path.join(installed, file), path.join(directory, file));
      }
      for (const header of [
        'react/renderer/componentregistry/ComponentDescriptorFactory.h',
        'react/renderer/mounting/MountingOverrideDelegate.h',
        'react/renderer/mounting/ShadowView.h',
        'react/renderer/mounting/ShadowViewMutation.h',
      ]) {
        const stub = path.join(directory, header);
        fs.mkdirSync(path.dirname(stub), {recursive: true});
        fs.writeFileSync(stub, '');
      }
      const executable = path.join(directory, 'listener');
      const build = spawnSync(
        compiler,
        [
          '-std=c++20',
          '-O0',
          '-Wall',
          '-Wextra',
          '-Werror',
          '-include',
          path.join(root, 'test/native/screens-removal-listener-doubles.h'),
          '-I',
          directory,
          path.join(directory, 'RNSScreenRemovalListener.cpp'),
          path.join(root, 'test/native/screens-removal-listener.cpp'),
          '-o',
          executable,
        ],
        {encoding: 'utf8', timeout: 30000},
      );
      expect(build.error).toBeUndefined();
      expect(build.stderr).toBe('');
      expect(build.status).toBe(0);
      const run = spawnSync(executable, [], {encoding: 'utf8', timeout: 10000});
      expect(run.error).toBeUndefined();
      expect(run.stderr).toBe('');
      expect(run.status).toBe(0);
      expect(run.stdout).toContain('screen removal listener cases passed');
    } finally {
      fs.rmSync(directory, {recursive: true, force: true});
    }
  },
  45000,
);
