module.exports = function(grunt) {
  var options = {
    eslint: {
      options: {
        configFile: './.eslintrc.json'
      },
      src: ['src/**/*.js']
    },
    mochaTest: {
      options: { reporter: 'spec' },
      src: 'test/**/*.js'
    }
  };
  grunt.initConfig(options);
  grunt.loadNpmTasks("gruntify-eslint");
  grunt.loadNpmTasks('grunt-mocha-test');
  grunt.registerTask('default', ['eslint', 'mochaTest']);
};

