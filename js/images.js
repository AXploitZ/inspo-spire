(function () {
  "use strict";

  var App = window.App = window.App || {};

  App.resizeImageFile = function (file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = reject;
      reader.onload = function (e) {
        var img = new Image();
        img.onerror = reject;
        img.onload = function () {
          var maxW = 1000;
          var scale = Math.min(1, maxW / img.width);
          var w = Math.round(img.width * scale), h = Math.round(img.height * scale);
          var canvas = document.createElement("canvas");
          canvas.width = w; canvas.height = h;
          canvas.getContext("2d").drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL("image/jpeg", 0.85));
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  };

  App.resizeImageFromBlob = function (blob) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(blob);
      var img = new Image();
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("decode failed")); };
      img.onload = function () {
        var maxW = 1000;
        var scale = Math.min(1, maxW / img.width);
        var w = Math.round(img.width * scale), h = Math.round(img.height * scale);
        var canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        try { resolve(canvas.toDataURL("image/jpeg", 0.85)); }
        catch (e) { reject(e); }
      };
      img.src = url;
    });
  };

  App.handleFile = function (file) {
    if (!file.type.startsWith("image/")) { App.showToast("Please choose an image file.", true); return; }
    App.syncFormToState();
    App.resizeImageFile(file).then(function (dataUrl) {
      App.state.formImageData = dataUrl;
      App.state.formImageIsNew = true;
      App.render();
    }).catch(function () {
      App.showToast("Couldn't read that image.", true);
    });
  };

  App.focusVocabInput = function () {
    var el = document.getElementById("modalOverlay");
    if (el) { var input = el.querySelector("#vocabInput"); if (input) input.focus(); }
  };

  App.handleVideoFile = function (file) {
    var validTypes = ["video/mp4", "video/webm", "image/gif", "video/ogg", "video/quicktime"];
    if (validTypes.indexOf(file.type) === -1 && !file.type.startsWith("video/")) {
      App.showToast("Please choose a video file (mp4, webm, or gif).", true);
      return;
    }
    if (file.size > 100 * 1024 * 1024) {
      App.showToast("Video is too large — GitHub's limit is 100MB.", true);
      return;
    }
    App.syncFormToState();
    var reader = new FileReader();
    reader.onload = function (e) {
      App.state.formVideoData = e.target.result;
      App.state.formVideoIsNew = true;
      App.render();
    };
    reader.onerror = function () {
      App.showToast("Couldn't read that video file.", true);
    };
    reader.readAsDataURL(file);
  };
})();
