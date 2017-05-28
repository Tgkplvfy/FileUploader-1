;(function(window, undefined){
    /**
     * 生成长度为len的随机字符串
     * @param {int} len 
     */
    function randomKey(len) {
        var chars = 'ABCDEFGHJKMNPQRSTWXYZabcdefhijkmnprstwxyz0123456789';   

        var pwd = '';
        　var maxPos = chars.length;
        if(len <= 0){
            len = 12;
        }
        for (i = 0; i < len; i++) {
            　pwd += chars.charAt(Math.floor(Math.random() * maxPos));
        }
        return pwd;
    }
    
    /**
     * 文件信息对象
     * @param {File} file 
     */
    function FileInfo(file){
        this.oid = randomKey(12);//文件唯一编码

        this.state = "queued";//文件状态 queued, active, paused, cancelled, complete, error 

        this.name = file.name;//文件名称
        this.size = file.size;//文件大小
        this.type = file.type;//文件类型
        this.lastModify = file.lastModified;//文件最后修改时间
        
        this.retry = 0;//错误重试次数
        this.loaded = 0;//已完成大小

        this.source = file;//原始文件对象
        this.getSource = function(){
            return this.source;
        }
        this.isTheSame = function(file){
            if(file.name==this.name && file.size==this.size){
                return true;
            }
            return false;
        }
    }

    /**
	Gets the true type of the built-in object (better version of typeof).
	@author Angus Croll (http://javascriptweblog.wordpress.com/)
	@method typeOf
	@for Utils
	@static
	@param {Object} o Object to check.
	@return {String} Object [[Class]]
	*/
	var typeOf = function(o) {
		if (o === undefined) {
			return 'undefined';
		} else if (o === null) {
			return 'null';
		} else if (o.nodeType) {
			return 'node';
		}

		// the snippet below is awesome, however it fails to detect null, undefined and arguments types in IE lte 8
		return ({}).toString.call(o).match(/\s([a-z|A-Z]+)/)[1].toLowerCase();
	};

    /**
	Executes the callback function for each item in array/object. If you return false in the
	callback it will break the loop.

	@method each
	@static
	@param {Object} obj Object to iterate.
	@param {function} callback Callback function to execute for each item.
	*/
	var each = function(obj, callback) {
		var length, key, i, undef;
		if (obj) {
			try {
				length = obj.length;
			} catch(ex) {
				length = undef;
			}

			if (length === undef) {
				// Loop object items
				for (key in obj) {
					if (obj.hasOwnProperty(key)) {
						if (callback(obj[key], key) === false) {
							return;
						}
					}
				}
			} else {
				// Loop array items
				for (i = 0; i < length; i++) {
					if (callback(obj[i], i) === false) {
						return;
					}
				}
			}
		}
	};

    /**
	Find an element in array and return it's index if present, otherwise return -1.
	
	@method inArray
	@static
	@param {Mixed} needle Element to find
	@param {Array} array
	@return {Int} Index of the element, or -1 if not found
	*/
	var inArray = function(needle, array) {
		if (array) {
			if (Array.prototype.indexOf) {
				return Array.prototype.indexOf.call(array, needle);
			}
		
			for (var i = 0, length = array.length; i < length; i++) {
				if (array[i] === needle) {
					return i;
				}
			}
		}
		return -1;
	};

    /**
	Extends the specified object with another object.

	@method extend
	@static
	@param {Object} target Object to extend.
	@param {Object} [obj]* Multiple objects to extend with.
	@return {Object} Same as target, the extended object.
	*/
	var extend = function(target) {
		var undef;

		each(arguments, function(arg, i) {
			if (i > 0) {
				each(arg, function(value, key) {
					if (value !== undef) {
						if (typeOf(target[key]) === typeOf(value) && !!~inArray(typeOf(value), ['array', 'object'])) {
							extend(target[key], value);
						} else {
							target[key] = value;
						}
					}
				});
			}
		});
		return target;
	};

    var defaults = {
        chunk_size      :   1024*1024,//数据块大小
        max_file_size   :   -1,//最大文件大小,-1=no limit
        max_retry       :   3,//错误重试次数
        max_file_upload :   1,//最大并发上传文件数
        mime_types      :   [ //只允许上传图片和zip,rar文件
            //{ title : "Zip file_list", extensions : "zip,rar" }
        ],
        headers         :   {
        },//自定义HTTP请求头标
        target          :   "aliyun",//aliyun,tencent,local云平台名称
        cmd_url         :   "php/filemgr.php",//文件上传授权地址
        cmd_opts        :   {},//命令请求参数，自定义
        data_url        :   "php/filemgr.php",
        onFileAdded         :   null,//文件成功添加回调
        onFileRemoved       :   null,//删除文件回调
        onBeforeUpload      :   null,//文件上传前回调
        onFileUploaded      :   null,//文件上传完成回调
        onUploadProgress    :   null,//文件上传进度更新回调
        onUploadComplete    :   null,//文件全部上传完成回调，多个文件
        onUploadError       :   null,//文件上传错误回调

        //FileManager回调函数
        onCommandError      :   null,//命令执行失败回调
        onCommandComplete   :   null,//命令执行成功回调
    };

    function FileUploader(opts){
        var defaults = {
            chunk_size      :   1024*1024,//数据块大小
            max_file_size   :   -1,//最大文件大小,-1=no limit
            max_retry       :   3,//错误重试次数
            max_file_upload :   1,//最大并发上传文件数
            mime_types      :   [ //只允许上传图片和zip,rar文件
                //{ title : "Zip file_list", extensions : "zip,rar" }
            ],
            headers         :   {
            },//自定义HTTP请求头标
            target          :   "aliyun",//aliyun,tencent,local云平台名称
            cmd_url    :   "../../view/xhr/filemgr.php",//文件上传授权地址
            cmd_opts   :   {
                cmd    :    "auth",
            },//命令请求参数，自定义
            data_url        :   "../../view/xhr/filemgr.php",
            onFileAdded         :   null,//文件成功添加回调
            onFileRemoved       :   null,//删除文件回调
            onBeforeUpload      :   null,//文件上传前回调
            onFileUploaded      :   null,//文件上传完成回调
            onUploadProgress    :   null,//文件上传进度更新回调
            onUploadComplete    :   null,//文件全部上传完成回调，多个文件
            onUploadError       :   null,//文件上传错误回调

            //FileManager回调函数
            onCommandError      :   null,//命令执行失败回调
            onCommandComplete   :   null,//命令执行成功回调
        };

        //初始化上传插件参数
        var settings = extend({}, defaults, opts?opts:{});

        var currPath = "";//current working directory

        //文件数组
        var file_list = new Array();
        var done_list = new Array();

        var self = this;
        /**
         * 添加文件对象,将file转换为FileInfo
         * @param {File} file or file-like object 
         */
        function addItem(file){
            var temp = findItem(file, false);
            if(temp){
                return temp;
            }
            
            temp = new FileInfo(file);
            file_list.push(temp);
            if(settings.onFileAdded){
                settings.onFileAdded(self, temp);
            }
            return temp;
        }

        /**
         * search file info object
         * @param {File or File link object}
         * @param {boolean} erase, erase=true, find and remove 
         */
        function findItem(file, erase){
            for(var i=0; i<file_list.length; i++){
                var temp = file_list[i];
                if(temp.isTheSame(file)){
                    if(erase){
                        file_list.splice(i, 1);
                    }
                    return temp;
                }
            }
            for(var i=0; i<done_list.length; i++){
                var temp = done_list[i];
                if(temp.isTheSame(file)){
                    if(erase){
                        done_list.splice(i, 1);
                    }
                    return temp;
                }
            }
            return null;
        }

        /**
         * 删除文件对象
         * @param {File or File link object}
         */
        this.removeFile = function(file){
            var temp = findItem(file, true);
            if(temp){
                if(settings.onFileRemoved){
                    settings.onFileRemoved(self, temp);
                }
            }
            return temp;
        }

        /**
         * 添加文件对象
         */
        this.addFile = function(obj){
            if(obj instanceof File){
                return addItem(obj);
            }
            if(obj instanceof Blob){
                obj.name = randomKey(16);
                obj.lastModified = (new Date()).getTime();
                return addItem(obj);
            }

            var arr = null;
            var type = typeOf(obj);
            if(type==="node" && obj.files && typeOf(obj.files)==="filelist"){//file is HTMLInputElement
                arr = this.addFile(obj.files);
            } else if(type==="array" || type=="filelist"){
                arr = new Array();
                for(var i=0; i<obj.length; i++){
                    var temp = addItem(obj[i]);
                    if(temp){
                        arr.push(temp);
                    }
                }
            }
            return arr;
        }

        var fileUploading = 0;//uploading file count
        var uploadFile = function(file){
            var params = {};//file upload post params, optional
            if(!settings.onBeforeUpload){
                file.state = "active";
                params.filename = file.name;
                params.filesize = file.size;
                params.filetype = file.type;
                uploadNextChunk(file, params);
                fileUploading++;
            } else {
                file.state = "active";
                settings.onBeforeUpload(self, file, function(finfo, host, headers, options){
                    if(!options){
                        file.state = "cancelled";
                    } else {
                        params.filename = file.name;
                        params.filesize = file.size;
                        params.filetype = file.type;
                        if(finfo["exist"]=="full"){
                            file.loaded = file.size;
                            onFileUploaded(file, params);
                            return;
                        }
                        if(finfo["exist"]=="partial"){//断点续传
                            file.loaded = options["fsize"];
                        }

                        //获得服务器授权或可选参数
                        settings.headers = extend({}, settings.headers, headers?headers:{});
                        params = extend({}, params, options?options:{});
                        settings.data_url = host;

                        uploadNextChunk(file, params);
                        fileUploading++;
                    }
                });
            }
        }

        /**
         * upload next file
         */
        var uploadNextFile = function(file){
            //uploader not active or uploading file count over limitation, wait for next time
            if(self.state!="active" || fileUploading==settings.max_file_upload){
                return;
            }

            if(file){
                uploadFile(file);
                return;
            }

            if(file_list.length==0 && self.state!="completed"){
                onUploadComplete();
                return;
            }
            for(var i=0; i<file_list.length; i++){
                file = file_list[i];
                if(file.state=="queued"){
                    uploadFile(file);
                    
                    //break when uploading file count over limitation
                    if(fileUploading==settings.max_file_upload){
                        break;
                    }
                }
            }
        }

        /**
         * upload error occurence
         * @param {XMLHttpRequest} xhr 
         * @param {FileInfo} file 
         * @param {Object} params 
         */
        var onUploadError = function(xhr, file, params){
            file.state = "error";
            fileUploading--;
            findItem(file, true);
            if(settings.onUploadError){
                settings.onUploadError(self, file, params, xhr.status, xhr.responseText);
            }
            done_list.push(file);

            //start to upload next file in queue
            uploadNextFile(null);
        }

        /**
         * notify file chunk upload complete
         * @param {FileInfo} file 
         * @param {int} chunk_size 
         * @param {Object} params 
         */
        var onUploadProgress = function(file, chunk_size, params){
            if(settings.onUploadProgress){
                settings.onUploadProgress(self, file, params);
            }
        }

        /**
         * notify one file upload completed
         * @param {FileInfo} file 
         * @param {Object} params 
         */
        var onFileUploaded = function(file, params){
            file.state = "completed";
            fileUploading--;
            findItem(file, true);
            if(settings.onFileUploaded){
                settings.onFileUploaded(self, file, params);
            }
            done_list.push(file);

            //start to upload next file in queue
            uploadNextFile(null);
        }

        /**
         * notify all file_list upload completed
         */
        var onUploadComplete = function(){
            self.state = "completed";
            if(settings.onUploadComplete){
                settings.onUploadComplete(self, done_list);
            }
        }

        /**
         * upload next file chunk
         * @param {FileInfo} file 
         * @param {Object} params, file upload post params, optional
         */
        var uploadNextChunk = function(file, params){
            if(file.state!="active" || self.state!="active"){
                return;
            }

            var blob = file.getSource();
            var form = new FormData();
            if(!params.total_chunk){
                if(file.size > settings.chunk_size && settings.chunk_size > 0){
                    params.total_chunk = Math.floor((file.size + settings.chunk_size - 1) / settings.chunk_size);
                }
            }

            var chunk_size = file.size - file.loaded;
            if(chunk_size > settings.chunk_size){
                chunk_size = settings.chunk_size;
            }
            if(file.size > settings.chunk_size){
                params.chunkid = Math.floor(file.loaded / settings.chunk_size) + 1;
                params.chunk_size = settings.chunk_size;
            } 
            each(params, function(value, key){
                form.append(key, value);
            });

            var xhr = new XMLHttpRequest();
            xhr.onerror = function(evt){
                console.log("upload error");
                if(settings.max_retry>0 && file.retry<settings.max_retry){
                    file.retry++;
                    uploadNextChunk(file, params);
                    return;
                }
                onUploadError(xhr, file, params);
            }
            xhr.onloadend = function(evt){
                xhr = null;
            }
            // if(xhr.upload){
            //     xhr.upload.onprogress = function(evt){
            //         onUploadProgress(file, chunk_size, params);
            //     }
            // }
            xhr.onload = function(evt){
                if(xhr.status >= 400){
                    onUploadError(xhr, file, params);
                    return;
                }

                var error_retry = false;
                try{
                    var ret_arr = eval("(" + xhr.responseText + ")");
                    if(params.chunkid){
                        if(ret_arr["code"]!=200){
                            error_retry = true;
                        }
                    } else if(ret_arr.length>0) {
                        ret_arr = ret_arr[0];
                        if(ret_arr["code"]!=200){
                            error_retry = true;
                        }
                    }
                } catch(ex){
                    error_retry = true;
                }
                if(error_retry){
                    if(settings.max_retry>0 && file.retry<settings.max_retry){
                        file.retry++;
                        uploadNextChunk(file, params);
                        return;
                    }
                    onUploadError(xhr, file, params);
                    return;
                }

                file.loaded += chunk_size;
                onUploadProgress(file, chunk_size, params);
                if(file.retry > 0){
                    file.retry = 0;
                }

                if(file.loaded==file.size){
                    onFileUploaded(file, params);
                } else {
                    uploadNextChunk(file, params);
                }
            };

            xhr.open("post", settings.data_url, true);
            each(settings.headers, function(value, key){
                xhr.setRequestHeader(key, value);
            });
            if(currPath.length>0){
                form.append("path", currPath);
            }
            if(file.size < settings.chunk_size || settings.chunk_size <= 0){
                form.append("cmd", "files");
                form.append("files", blob);
            } else {
                console.log("chunkid=" + params.chunkid + ", chunk offset=" + file.loaded + ", chunk size = " + chunk_size);
                var chunk = blob.slice(file.loaded, file.loaded + chunk_size);
                form.append("cmd", "chunk");
                form.append("chunk_data", chunk);
            }
            xhr.send(form);
        }

        /**
         * start all file or one file upload
         * @param {FileUploader} myobj 
         * @param {FileInfo} file,optional 
         */
        var start = function(myobj, file){
            if(file_list.length==0){
                return;
            }

            if(file==null){
                myobj.state = "active";
                uploadNextFile(null);
            } else {
                myobj.state = "active";
                if(file.state=="paused"){
                    file.state = "active";
                    uploadNextFile(file);
                }
            }
        }

        /**
         * pause all file or one file upload
         * @param {FileUploader} myobj 
         * @param {FileInfo} file,optional 
         */
        var pause = function(myobj, file){
            if(file==null){
                myobj.state = "paused";
            } else if(file.state=="active") {
                file.state = "paused";
            }
        }

        /**
         * reset uploader or file state
         * @param {FileUploader} myobj 
         * @param {FileInfo} file 
         */
        var reset = function(myobj, file){
            if(file!=null){
                file.state = "queued";
                file.loaded = 0;
            } else {
                myobj.state = "none";
                file_list.splice(0, file_list.length);
                done_list.splice(0, done_list.length);
            }
        }

        /**
         * uploader work state
         */
        this.state = "none";//none|active|paused|stopped|completed

        /**
         * file list:queued,paused,active
         */
        this.files = function(){
            return file_list;
        }
        /**
         * file list:finished or errored
         */
        this.done = function(){
            return done_list;
        }

        /**
         * set current working directory
         */
        this.cwd = function(path){
            currPath = path;
        }

        /**
         * 执行命令,
         * @param {string} cmd:[start|pause|cancel|reset]
         * @param {File | string} fid:optional, fid=null do command to all
         */
        this.execute = function(cmd, fid){
            var file = null;
            if(fid){
                file = findItem(fid, false);
            }

            switch(cmd){
                case "start":
                    start(this, file);
                    break;
                case "pause":
                    pause(this, file);
                    break;
                case "reset":
                    reset(this, file);
                    break;
            }
        }
    }
    window.FileUploader = FileUploader;

    /**
     * 文件管理器
     * @param {*} opts 
     */
    function FileManager(opts){
        var defaults = {
            chunk_size      :   1024*1024,//数据块大小
            max_file_size   :   -1,//最大文件大小,-1=no limit
            max_retry       :   3,//错误重试次数
            max_file_upload :   1,//最大并发上传文件数
            mime_types      :   [ //只允许上传图片和zip,rar文件
                //{ title : "Zip file_list", extensions : "zip,rar" }
            ],
            headers         :   {
            },//自定义HTTP请求头标
            target          :   "aliyun",//aliyun,tencent,local云平台名称
            cmd_url    :   "php/filemgr.php",//文件上传授权地址
            cmd_opts   :   {
            },//命令请求参数，自定义
            onFileAdded         :   null,//文件成功添加回调
            onFileRemoved       :   null,//删除文件回调
            onBeforeUpload      :   null,//文件上传前回调
            onFileUploaded      :   null,//文件上传完成回调
            onUploadProgress    :   null,//文件上传进度更新回调
            onUploadComplete    :   null,//文件全部上传完成回调，多个文件
            onUploadError       :   null,//文件上传错误回调
        };

        //初始化上传插件参数
        var settings = extend({}, defaults, opts?opts:{});

        //文件上传组件
        var myuploader = null;

        var self = this;
        var onBeforeUpload = function(up, file, callback){
            var params = {
                cmd         :   "fopen",
                filename    :   file.name,
                filesize    :   file.size,
                filetype    :   file.type,
                filepath    :   currPath,
            };
            execute(params, callback);
        }

        var currPath = "";//当前工作目录 current work directory
        /**
         * 设置当前工作目录
         */
        this.cwd = function(path){
            if(myuploader!=null){
                myuploader.cwd(path);
            }
            currPath = path;
        }

        /**
         * 删除文件对象
         */
        this.unlink = function(path){
            var params = extend({}, settings.cmd_opts?settings.cmd_opts:{});
            params.cmd = "unlink";
            params.path = path;
            execute(params, null);
        }
        
        /**
         * 检查path路径的目录或文件是否存在
         */
        this.exist = function(path){
            var params = extend({}, settings.cmd_opts?settings.cmd_opts:{});
            params.cmd = "exist";
            params.path = path;
            execute(params, null);
        }
        
        /**
         * 修改目录或文件名称
         */
        this.rename = function(old_path, new_path){
             var params = extend({}, settings.cmd_opts?settings.cmd_opts:{});
            params.cmd = "rename";
            params.old_path = old_path;
            params.new_path = new_path;
            execute(params, null);
        }

        /**
         * 列举path路径下的目录与文件
         */
        this.list = function(path){
            var params = extend({}, settings.cmd_opts?settings.cmd_opts:{});
            params.cmd = "list";
            params.path = path;
            execute(params, null);
        }

        /**
         * 创建目录
         */
        this.mkdir = function(path){
             var params = extend({}, settings.cmd_opts?settings.cmd_opts:{});
            params.cmd = "mkdir";
            params.path = path;
            execute(params, null);
        }

        /**
         * 删除目录
         */
        this.rmdir = function(path){
             var params = extend({}, settings.cmd_opts?settings.cmd_opts:{});
            params.cmd = "rmdir";
            params.path = path;
            execute(params, null);
        }

        /**
         * 获取文件上传对象
         */
        this.uploader = function(){
            if(!myuploader){
                myuploader = new FileUploader({
                    chunk_size          :   settings.chunk_size,
                    max_file_size       :   settings.max_file_size,
                    max_file_upload     :   settings.max_file_upload,

                    max_retry           :   settings.max_retry,

                    cmd_url             :   "../../view/xhr/filemgr.php",
                    cmd_opts            :   settings.cmd_opts,
                    headers             :   settings.headers,

                    onBeforeUpload      :   onBeforeUpload,//获取服务器上传确认与许可
                });
                if(currPath.length>0){
                    myuploader.cwd(currPath);
                }
            }
            return myuploader;
        }

        var onCommandComplete = function(cmd, status, ret_arr, callback){
            if(cmd=="fopen"){
                var fileinfo = ret_arr ? ret_arr["fileinfo"] : null;
                if(status!="success"){
                    callback(fileinfo, null, null, null);
                } else {
                    var host = ret_arr["host"];
                    if(!host || host.length==0){
                        host = settings.cmd_url;
                    }

                    var headers = ret_arr["headers"];
                    var options = ret_arr["options"];
                    if(fileinfo["exist"]=="diff"){//文件存在且不一致，删除重传
                        self.unlink(fileinfo["path"]);
                        fileinfo["exist"] = "none";
                    }
                    callback(fileinfo, host, headers, options);
                }
                return;
            }

            if(settings.onCommandComplete){
                settings.onCommandComplete(cmd, status, ret_arr);
            }
        }

        function execute(params, callback){
            var xhr = new XMLHttpRequest();
            var form = new FormData();
            params = extend({}, params, settings.cmd_opts?settings.cmd_opts:{});
            each(params, function(value, name){
                form.append(name, value);
            });
            each(settings.headers, function(value, name){
                xhr.setRequestHeader(name, value);
            });
            xhr.open("post", settings.cmd_url, true);
            xhr.onerror = function(evt){
                onCommandComplete(params.cmd, "error", null, callback);
            }
            xhr.onloadend = function(evt){
                xhr = null;
            }
            xhr.onload = function(evt){
                if(xhr.status>=400){
                    onCommandComplete(params.cmd, "error", null, callback);
                    return;
                }

                var ret_arr = eval("(" + xhr.responseText + ")");
                if(ret_arr["code"]!=200){
                    onCommandComplete(params.cmd, "error", ret_arr, callback);
                    return;
                }
                onCommandComplete(params.cmd, "success", ret_arr, callback);
            }
            xhr.send(form);
        }
    }
    window.FileManager = FileManager;
})(window);