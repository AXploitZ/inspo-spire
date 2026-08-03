(function () {
  "use strict";

  var config = null;
  var dataSha = null;
  var imageBlobCache = {};

  // --- Base64 helpers ---

  function b64Encode(str) {
    return btoa(
      encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function (m, p1) {
        return String.fromCharCode("0x" + p1);
      })
    );
  }

  function b64Decode(str) {
    return decodeURIComponent(
      atob(str.replace(/\n/g, ""))
        .split("")
        .map(function (c) {
          return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
        })
        .join("")
    );
  }

  // --- Error classification ---

  function classifyError(status) {
    if (status === 401 || status === 403)
      return {
        type: "auth",
        message: "Authentication failed — check your token's permissions",
      };
    if (status === 404)
      return {
        type: "notfound",
        message: "Repo not found — check owner/repo and token access",
      };
    if (status === 422)
      return {
        type: "conflict",
        message:
          "Sync conflict — another tab may be editing. Try refreshing.",
      };
    if (status >= 500)
      return {
        type: "server",
        message: "GitHub error — try again in a moment",
      };
    return { type: "unknown", message: "GitHub error (" + status + ")" };
  }

  // --- HTTP helpers ---

  function headers(extra) {
    var h = {
      Authorization: "Bearer " + config.token,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };
    if (extra) for (var k in extra) h[k] = extra[k];
    return h;
  }

  function repoBase() {
    return "/repos/" + config.owner + "/" + config.repo;
  }

  async function apiGet(path) {
    try {
      var res = await fetch("https://api.github.com" + path, {
        headers: headers(),
        cache: "no-store",
      });
      if (res.status === 404) return null;
      if (!res.ok) throw res;
      return await res.json();
    } catch (e) {
      if (e instanceof Response) {
        var err = classifyError(e.status);
        throw new Error(err.message);
      }
      throw new Error("Connection lost — check your internet");
    }
  }

  async function apiPut(path, body) {
    try {
      var res = await fetch("https://api.github.com" + path, {
        method: "PUT",
        headers: headers({ "Content-Type": "application/json" }),
        body: JSON.stringify(body),
        cache: "no-store",
      });
      if (!res.ok) throw res;
      return await res.json();
    } catch (e) {
      if (e instanceof Response) {
        var err = classifyError(e.status);
        throw new Error(err.message);
      }
      throw new Error("Connection lost — check your internet");
    }
  }

  async function apiDelete(path, body) {
    try {
      var res = await fetch("https://api.github.com" + path, {
        method: "DELETE",
        headers: headers({ "Content-Type": "application/json" }),
        body: JSON.stringify(body),
      });
      return res.ok;
    } catch (e) {
      return false;
    }
  }

  // --- Schema validation ---

  function validateLibrary(parsed) {
    if (!parsed || typeof parsed !== "object") {
      throw new Error(
        "Library data is corrupted — expected {items:[], customTypes:[]} structure"
      );
    }
    if (!Array.isArray(parsed.items)) {
      throw new Error(
        "Library data is corrupted — 'items' must be an array"
      );
    }
    if (!Array.isArray(parsed.customTypes)) {
      throw new Error(
        "Library data is corrupted — 'customTypes' must be an array"
      );
    }
    for (var i = 0; i < parsed.items.length; i++) {
      var it = parsed.items[i];
      if (!it.id || !it.title || !it.elementType) {
        throw new Error(
          "Library data is corrupted — item #" +
            (i + 1) +
            " is missing required fields (id, title, elementType)"
        );
      }
    }
    return true;
  }

  // --- Public API ---

  function configure(cfg) {
    config = cfg;
  }

  function isConfigured() {
    return !!(config && config.owner && config.repo && config.token);
  }

  async function loadLibrary() {
    var path = "data/library.json";
    var file = await apiGet(
      repoBase() + "/contents/" + path + "?ref=" + encodeURIComponent(config.branch)
    );
    if (file) {
      var jsonStr = b64Decode(file.content);
      var parsed = JSON.parse(jsonStr);
      validateLibrary(parsed);
      dataSha = file.sha;
      return {
        items: parsed.items,
        customTypes: parsed.customTypes,
        sha: file.sha,
      };
    }
    // File doesn't exist yet — initialize it
    var initial = b64Encode(
      JSON.stringify({ items: [], customTypes: [] }, null, 2)
    );
    var created = await apiPut(repoBase() + "/contents/" + path, {
      message: "Initialize design library",
      content: initial,
      branch: config.branch,
    });
    dataSha = created.content.sha;
    return { items: [], customTypes: [], sha: created.content.sha };
  }

  async function saveLibrary(data, message) {
    var path = "data/library.json";
    var content = b64Encode(JSON.stringify(data, null, 2));

    // Use the SHA from our last successful write — the queue guarantees
    // no other writes from this session happened in between, so this
    // SHA is correct and avoids GitHub API read-caching delays.
    var sha = dataSha;
    if (!sha) {
      var latest = await readSha(path);
      sha = latest;
    }

    try {
      var result = await apiPut(repoBase() + "/contents/" + path, {
        message: message || "Update library",
        content: content,
        sha: sha,
        branch: config.branch,
      });
      dataSha = result.content.sha;
      return result.content.sha;
    } catch (e) {
      // SHA conflict (422) — re-read from API and retry
      if (e.message && e.message.indexOf("Sync conflict") !== -1) {
        var retrySha = await readSha(path);
        var retryResult = await apiPut(repoBase() + "/contents/" + path, {
          message: message || "Update library",
          content: content,
          sha: retrySha,
          branch: config.branch,
        });
        dataSha = retryResult.content.sha;
        return retryResult.content.sha;
      }
      throw e;
    }
  }

  async function readSha(path) {
    try {
      var res = await fetch(
        "https://api.github.com" +
          repoBase() +
          "/contents/" +
          path +
          "?ref=" +
          encodeURIComponent(config.branch),
        { headers: headers(), cache: "no-store" }
      );
      if (!res.ok) return null;
      var json = await res.json();
      return json.sha;
    } catch (e) {
      return null;
    }
  }

  async function uploadImage(dataUrl, idHint) {
    var match = dataUrl.match(/^data:(image\/\w+);base64,(.*)$/);
    if (!match) throw new Error("Invalid image data");
    var ext = match[1] === "image/png" ? "png" : "jpg";
    var base64 = match[2];
    var filename = "images/" + idHint + "." + ext;
    await apiPut(repoBase() + "/contents/" + filename, {
      message: "Add image " + filename,
      content: base64,
      branch: config.branch,
    });
    return filename;
  }

  async function deleteFile(path, sha, message) {
    return await apiDelete(repoBase() + "/contents/" + path, {
      message: message,
      sha: sha,
      branch: config.branch,
    });
  }

  function resolveImageUrl(path) {
    if (!path) return "";
    if (path.indexOf("http") === 0 || path.indexOf("data:") === 0) return path;
    if (config.visibility === "public") {
      return (
        "https://raw.githubusercontent.com/" +
        config.owner +
        "/" +
        config.repo +
        "/" +
        config.branch +
        "/" +
        path
      );
    }
    // Private repo — check blob cache
    if (imageBlobCache[path] && imageBlobCache[path] !== "pending")
      return imageBlobCache[path];
    fetchPrivateImage(path);
    return "";
  }

  async function fetchPrivateImage(path) {
    if (imageBlobCache[path] === "pending") return;
    imageBlobCache[path] = "pending";
    try {
      var res = await fetch(
        "https://api.github.com" +
          repoBase() +
          "/contents/" +
          path +
          "?ref=" +
          encodeURIComponent(config.branch),
        { headers: headers({ Accept: "application/vnd.github.raw+json" }) }
      );
      if (!res.ok) throw new Error("image fetch failed");
      var blob = await res.blob();
      imageBlobCache[path] = URL.createObjectURL(blob);
    } catch (e) {
      delete imageBlobCache[path];
    }
  }

  function clearCache() {
    for (var key in imageBlobCache) {
      if (imageBlobCache[key] && imageBlobCache[key] !== "pending") {
        URL.revokeObjectURL(imageBlobCache[key]);
      }
    }
    imageBlobCache = {};
  }

  // --- Expose ---

  window.GitHubAPI = {
    configure: configure,
    isConfigured: isConfigured,
    loadLibrary: loadLibrary,
    saveLibrary: saveLibrary,
    uploadImage: uploadImage,
    deleteFile: deleteFile,
    resolveImageUrl: resolveImageUrl,
    fetchPrivateImage: fetchPrivateImage,
    clearCache: clearCache,
  };
})();
