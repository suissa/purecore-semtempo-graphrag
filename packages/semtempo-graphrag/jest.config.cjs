module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/test/**/*.test.ts'],
  moduleNameMapper: {
    '^@purecore/temporal-graph$': '<rootDir>/../temporal-graph/src/index.ts'
  },
  moduleFileExtensions: ['ts', 'js'],
  maxWorkers: 1
}
