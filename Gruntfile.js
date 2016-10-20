module.exports = function(grunt) {
  var options = {
    eslint: {
      options: {
        configFile: './.eslintrc.json'
      },
      src: ['src/**/*.js']
    }
  };
  grunt.initConfig(options);
  grunt.loadNpmTasks("gruntify-eslint");
  grunt.registerTask('default', ['eslint']);
};

