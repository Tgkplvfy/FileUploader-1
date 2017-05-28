# FileUploader
HTML5文件上传插件，支持大文件上传与断点续传，支持浏览器远程管理，包括上传文件、重改名、删除文件，列举文件与目录，新建目录，删除目录等功能，服务器后端用PHP实现。
目录结构：
demo.html     上传文件演示
js/FileManager.js 上传文件js代码
php/filemgr.php 接收命令PHP文件
php/FileManager.class.php 文件管理类

js/FileManager.js 主要包括两个功能模块：FileUploader与FileManager。FileUploader实现文件上传，支持断点续传功能。FileManager实现mkdir(创建目录)，rmdir(删除目录)，list(列举目录)，unlink（删除文件）,exists(文件或目录是否存在)，cwd(设置工作目录)，rename(修改文件名)等功能。

Usage 1：文件上传
1 <script src='js/FileManager.js' type='text/javascript'></script>
2 var uploader = new FileUploader(options); 
3 uploader.addFile(obj); obj:[input|File|FileList]
4 uploader.execute("start", null)

演示代码:
<script src='js/FileManager.js' type='text/javascript'></script>
<script type='text/javascript'>
  var uploader = new FileUploader({
      cmd_url             :   "php/filemgr.php",
      cmd_opts            :   {},
      chunk_size          :   1024*1024,            
      onBeforeUpload      :   onBeforeUpload,            
      onUploadProgress    :   onUploadProgress,            
      onFileUploaded      :   onFileUploaded,           
      onUploadError       :   onUploadError,            
  });
  var elem = document.querySelector("#the_form input[type='file']");
  uploader.addFile(elem);
  uploader.execute("start", "");
 </script>
