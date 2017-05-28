<?php
/***
* class FileManager
* HTTP交互模拟实现常用文件管理指令与文件上传下载，支持大文件断点续传
* author：雷子
* email : 977466652@qq.com
*/

class FileManager {
    /**
    * singleton
    */
    private static $_instance = null;

    public static function getInstance($params){
        if(self::$_instance){
            return self::$_instance;
        }
        self::$_instance = new FileManager();
        if($params){
            self::$_instance->setOptions($params);
        }
        return self::$_instance;
    }

    /**
    * 设置配置参数
    */
    public function setOptions($params){
        //TODO customize your options, including storage config
    }

    /**
    * 判断用户是否有权限执行命令$cmd
    */
    public function hasRights($cmd){
        //TODO modify this function to check user rights
        return true;
    }

    /**
    * 生成特定用户或会话的文件保存路径
    */
    function get_upload_filepath(){
        //TODO modify this function to generate file storage path for user or session
        $name = $_REQUEST["name"];
        $conf = $this->get_upload_config();
        $path = $conf["base_path"].$name;
        if(!is_dir($path)){
            mkdir($path, 0777, true);
        }
        return $path;
    }

    /**
    * 获取文件存储配置参数
    */
    function get_upload_config(){
        //TODO anybody can change this code to satisfy your storage config requirement
        return array(
            "base_path"=>__DIR__."/../upload/",
            "max_dir_depth"=>32,
            "max_file_size"=>10*1024*1024,//-1=no limit
            "max_file_count"=>2000,//-1=no limit
            "max_data_quota"=>1024*1024*1024,//-1=no limit
        );
    }

    /**
    * 深度优先遍历目录树，每个文件/目录调用回调函数
    * @params {string} $path, current directory 
    * @params {int} $level, dir deepth level
    * @params {array|object} $options, custom callback params 
    * @params {function} $callback, func($path, $level, $dir, $options)
    * @params {boolean}, true if completed, false if cancelled
    */
    public function dir_traverse($path, $level, $options, $callback){
        if(is_file($path)){
            $callback($path, $level, false, $options);
            return true;
        }

        $cancelled = false;
        $dir = opendir($path);
        while(false !== ($file = readdir($dir))){
            if($file=="." || $file==".."){
                continue;
            }
            $temp = $path."/".$file;
            if(!$this->dir_traverse($temp, $level + 1, $options, $callback)){
                $cancelled = true;
                break;
            }
        }
        closedir($dir);

        $callback($path, $level, true, $options);
        return !$cancelled;
    }

    /**
    * 判断文件/目录名称是否合法
    * 正常名称中不能包含[.\/]等特殊字符
    */
    public function isNameValid($name, $is_dir){
        return true;
        $matches = array();
        //TODO change regex or code to validate filename or dirname
        preg_match("#([\\\/])|(^\.{1,2})#", $name, $matches);
        if(count($matches)>0){
            return false;
        }
        return true;
    }

    /**
    * 检查是否超过文件存储配额
    */
    public function isOverQuota($path, $fsize){
        $conf = $this->get_upload_config();
        //1. check file size, ensure less equal to max_file_size
        if($conf["max_file_size"]>0 && $conf["max_file_size"]<$fsize){
            return true;
        }

        //2. disk free space is not enough
        $fdisk = disk_free_space($path);
        if($fdisk < $fsize){
            return true;
        }

        //3. ensure less than storage quota
        if($conf["max_data_quota"]>0 || $conf["max_file_count"]>0){
            $filecount = 0;
            $filequota = 0;
            $result = $this->dir_traverse($path, 0, null, function($path, $level, $dir, $options){
                $filecount++;
                $filequota += filesize($path);
                if($conf["max_file_count"]>0 && $filecount>=["max_file_count"]){
                    return false;
                }
                if($conf["max_data_quota"]>0 && $filequota>=["max_data_quota"]){
                    return false;
                }
                return true;
            });
            if(!$result){//beyond file count or data size quota
                return true;
            }
        }
        return false;
    }

    /**
    * 获取客户端上传的文件内容
    */
    public function get_upload_file_content($path, $file, &$ret_arr){
        if(!$this->isNameValid($file["name"], false)){//检查文件名称是否合法
            $ret_arr["code"] = 400;
            $ret_arr["error"] = "Invalid Request : filename is not valid";
            return;
        }

        $result = array();
        $result["file"] = $file["name"];
        if($file["error"]!=0){//检查文件传输错误或文件大小是否超过限制
            $result["code"] = 401;
            switch($file["error"]){
                case 4:
                    $result["error"] = "File not exist";
                    break;
                case "1":
                case "2":
                    $result["error"] = "File size is too large";
                    break;
                case "3":
                    $result["error"] = "File upload not complete";
                    break;
            }
        } else {
            if(!is_uploaded_file($file["tmp_name"])){//only support post file upload
                $result["code"] = 403;
                $result["error"] = "Access Forbidden:Only support post upload";
            } else {
                if(!isset($_REQUEST["path"])){
                    $path = $path."/".$file["name"];
                } else {
                    $curr = $_REQUEST["path"];
                    $path = $path."/".$curr."/".$file["name"];
                }
                if(move_uploaded_file($file["tmp_name"], $path)){
                    $result["code"] = 200;
                } else {
                    $result["code"] = 500;
                    $result["error"] = "Server Internal Error:save file failed";
                }
            }
        }
        array_push($ret_arr, $result);
    }

    /**
    * 获取客户端上传的文件或文件组
    */
    public function getUploadFiles(&$ret_arr){
        if(!isset($_FILES["files"]) || count($_FILES["files"])==0){
            $ret_arr["code"] = 401;
            $ret_arr["error"] = "No file upload";
            echo json_encode($ret_arr);
            return;
        }

        $path = $this->get_upload_filepath();
        if(!is_array($_FILES["files"]["name"])){//upload single file
            $file = $_FILES["files"];
            $this->get_upload_file_content($path, $file, $ret_arr);
        } else {//upload multiple file
            for($m=0; $m < count($_FILES["files"]["name"]); $m++){
                $file = array(
                    "name"=>$_FILES["files"]["name"][$m],
                    "type"=>$_FILES["files"]["type"][$m],
                    "size"=>$_FILES["files"]["size"][$m],
                    "error"=>$_FILES["files"]["error"][$m],
                    "tmp_name"=>$_FILES["files"]["tmp_name"][$m],
                );
                $this->get_upload_file_content($path, $file, $ret_arr);
            }
        }
    }

    /**
    * 获取客户端上传的文件数据块
    */
    public function getUploadChunk(&$ret_arr){
        if(!isset($_REQUEST["filename"]) || !isset($_REQUEST["filesize"]) || !isset($_REQUEST["chunkid"])){
            $ret_arr["code"] = 400;
            $ret_arr["error"] = "Invalid Request : filename or filesize missed";
            return;
        }
        $file = array("name"=>$_REQUEST["filename"], "size"=>$_REQUEST["filesize"]);
        if(isset($_REQUEST["filetype"])){
            $file["type"] = $_REQUEST["filetype"];
        }
        if(!$this->isNameValid($file["name"], false)){
            $ret_arr["code"] = 400;
            $ret_arr["error"] = "Invalid Request : invalid filename";
            return;
        }
        // if(isOverQuota($path, $file)){
        //     $ret_arr["code"] = 401;
        //     $ret_arr["error"] = "Invalid Request : file count or file size over limitation";
        //     return;
        // }

        $chunkid = 0 + $_REQUEST["chunkid"];
        $chunk_size = 0 + $_REQUEST["chunk_size"];

        $path = $this->get_upload_filepath();
        if(!isset($_REQUEST["path"])){
            $fpath = $path."/".$file["name"].".part";//生成临时文件，加.part后缀
        } else {
            $curr = $_REQUEST["path"];
            if(strpos($curr, "..")!==false){
                $ret_arr["code"] = 400;
                $ret_arr["error"] = "Invalid Parameter : file path can not contain string '..'";
                return;
            }
            $fpath = $path."/".$curr."/".$file["name"].".part";//生成临时文件，加.part后缀
        }

        //write chunk data to file
        $bsize = 0;
        $data = file_get_contents($_FILES["chunk_data"]["tmp_name"]);
        if($chunkid==1){
            $bsize = file_put_contents($fpath, $data);
        } else {
            $bsize = file_put_contents($fpath, $data, FILE_APPEND);
        }
        unlink($_FILES["chunk_data"]["tmp_name"]);//delete temp file

        $blob_size = 0 + $_FILES["chunk_data"]["size"];
        if($bsize != $blob_size){//fail if write data size not equal to upload blob size 
            $ret_arr["code"] = 500;
            return;
        }

        $total_chunk = 0 + $_REQUEST["total_chunk"];
        if($chunkid == $total_chunk){//change file name to orignal file name if last chunk
            $opath = $fpath;
            $pos = strrpos($opath, '.');
            if($pos>0){
                $opath = substr($opath, 0, $pos);
                rename($fpath, $opath);
            }
        }
        $ret_arr["code"] = 200;
        $ret_arr["chunkid"] = $chunkid;
    }

    /**
    * delete file
    */
    public function fileUnlink(&$ret_arr){
        if(!isset($_REQUEST["path"])){
            $ret_arr["code"] = 400;
            return;
        }
        $path = $_REQUEST["path"];
        if(strlen($path)==0 || strpos($path, "..")!==false){
            $ret_arr["code"] = 400;
            return;
        }
        
        $path = $this->get_upload_filepath()."/".$path;
        if(is_file($path)){
            unlink($path);
        }
        $ret_arr["code"] = 200;
    }

    /**
    * rename file or directory
    */
    public function new_name(&$ret_arr){
        if(!isset($_REQUEST["old_path"]) || !isset($_REQUEST["new_path"])){
            $ret_arr["code"] = 400;
            return;
        }
        $path = $_REQUEST["old_path"];
        $path2 = $_REQUEST["new_path"];
        if(strlen($path)==0 || strpos($path, "..")!==false){
            $ret_arr["code"] = 400;
            $ret_arr["error"] = "Invalid Parameter : file path can not contain string '..'";
            return;
        }
        if(strlen($path2)==0 || strpos($path2, "..")!==false){
            $ret_arr["error"] = "Invalid Parameter : file path can not contain string '..'";
            $ret_arr["code"] = 400;
            return;
        }

        $path = realpath($this->get_upload_filepath())."\\".$path;
        $path2 = realpath($this->get_upload_filepath())."\\".$path2;
        if(strcasecmp(dirname($path), dirname($path2))!==0){
            $ret_arr["code"] = 400;
            return;
        }
        
        if(rename($path, $path2)){
            $ret_arr["code"] = 200;
        } else {
            $ret_arr["code"] = 500;
            $ret_arr["error"] = error_get_last();
        }
    }

    /**
    * check file exists
    */
    public function exists(&$ret_arr){
        if(!isset($_REQUEST["path"])){
            $ret_arr["code"] = 400;
            return;
        }
        $path = $_REQUEST["path"];
        if(strlen($path)==0 || strpos($path, "..")!==false){
            $ret_arr["error"] = "Invalid Parameter : file path can not contain string '..'";
            $ret_arr["code"] = 400;
            return;
        }

        $result = array("path"=>$path);
        $fpath = $this->get_upload_filepath()."/".$path;
        if(is_dir($fpath)){
            $result["is_dir"] = 1;
            $result["exist"] = 1;
        } else if(is_file($fpath)){
            $result["is_dir"] = 0;
            $result["exist"] = 1;
            $result["size"] = filesize($fpath);
        } else {
            $ret_arr["code"] = 404;
        }
        if(isset($result["exist"])){
            $ret_arr["code"] = 200;
            $ret_arr["result"] = $result;
        }
    }

    /**
    * list file or directories
    */
    public function listDir(&$ret_arr){
        if(!isset($_REQUEST["path"])){
            $ret_arr["code"] = 400;
            return;
        }
        
        $path = $_REQUEST["path"];
        if(strpos($path, "..")!==false){
            $ret_arr["error"] = "Invalid Parameter : file path can not contain string '..'";
            $ret_arr["code"] = 400;
            return;
        }

        $fpath = $this->get_upload_filepath();
        if(strlen($path)>0){
            $fpath = $fpath."/".$path;
        }

        $list = array();
        $dir = opendir($fpath);
        while(($file=readdir($dir)) !== false){
            if($file=="." || $file==".."){
                continue;
            }

            $obj = null;
            $temp = $fpath."/".$file;
            if(is_file($temp)){
                $obj = array(
                    "name"=>$file,
                    "is_dir"=>0,
                    "size"=>filesize($temp),
                    "ctime"=>filectime($temp),
                    "mtime"=>filemtime($temp),
                );
            } else {
                $obj = array(
                    "name"=>$file,
                    "is_dir"=>1,
                );
            }
            array_push($list, $obj);
        }
        closedir($dir);

        $ret_arr["code"] = 200;
        $ret_arr["result"] = $list;
    }

    /**
    * create directory
    */
    public function dirCreate(&$ret_arr){
        if(!isset($_REQUEST["path"])){
            $ret_arr["code"] = 400;
            return;
        }
        
        $path = $_REQUEST["path"];
        if(strlen($path)==0 || strpos($path, "..")!==false){
            $ret_arr["code"] = 400;
            return;
        }

        $conf = $this->get_upload_config();
        if($conf["max_dir_depth"]>0){
            $arr = explode("/", $path);
            if(count($arr)>32){//max relative path depth 
                $ret_arr["code"] = 400;
                return;
            }
        }
        
        $fpath = $this->get_upload_filepath()."/".$path;
        if(!is_dir($fpath)){
            if(!mkdir($fpath, 0777, true)){
                $ret_arr["code"] = 500;
                return;
            }
        }
        $ret_arr["code"] = 200;
    }

    /**
    * remove directory
    */
    public function dirRemove(&$ret_arr){
        if(!isset($_REQUEST["path"])){
            $ret_arr["code"] = 400;
            return;
        }
        
        $path = $_REQUEST["path"];
        if(strlen($path)==0 || strpos($path, "..")!==false){
            $ret_arr["code"] = 400;
            return;
        }

        $fpath = $this->get_upload_filepath()."/".$path;
        if(is_dir($fpath)){
            $this->dir_traverse($fpath, 0, null, function($path, $level, $dir, $params){
                if($dir){
                    rmdir($path);
                } else {
                    unlink($path);
                }
                return true;
            });
        }
        $ret_arr["code"] = 200;
    }

    public function authFileOpen(&$ret_arr){
        if(!isset($_REQUEST["filename"]) || !isset($_REQUEST["filesize"])){
            $ret_arr["code"] = 400;
            return;
        }
        $size = 0 + $_REQUEST["filesize"];
        $name = $_REQUEST["filename"];

        $type = "";
        if(isset($_REQUEST["filetype"])){
            $type = $_REQUEST["filetype"];
        }

        $fpath = ""; $curr = "";
        if(!isset($_REQUEST["filepath"])){
            $fpath = $this->get_upload_filepath()."/".$name;
        } else {
            $curr = $_REQUEST["filepath"];
            $fpath = $this->get_upload_filepath()."/".$curr."/".$name;
        }

        $result = array("name"=>$name, "size"=>$size, "type"=>$type);

        if(is_file($fpath)){
            //检查文件是否存在,存在的文件是否一致
            $fsize = filesize($fpath);
            if($size==$fsize){
                $result["exist"] = "full";//文件存在且大小一致
            } else {
                $result["exist"] = "diff";//文件存在，但是大小不一致
            }
            $result["fsize"] = $fsize;
            $result["ctime"] = filectime($fpath);
            $result["mtime"] = filemtime($fpath);
        } else {
            //检查是否存在不完整上传文件
            $temp = $fpath.".part";
            if(!is_file($fpath)){
                $result["exist"] = "none";//文件不存在
            } else {
                $result["fsize"] = filesize($temp);
                $result["exist"] = "partial";//存在不完整文件,断点续传
                $result["ctime"] = filectime($temp);
                $result["mtime"] = filemtime($temp);
            }
        }
        if(strlen($curr)>0){
            $result["path"] = $curr."/".$name;
        } else {
            $result["path"] = $name;
        }

        //目录不存在，创建目录
        $path = dirname($fpath);
        if(!is_dir($path)){
            mkdir($path, 0777, true);
        }
        $ret_arr["code"] = 200;

        //TODO customize your data submit host, split command site and data site
        $ret_arr["host"] = "";

        $headers = array();
        //TODO customize http request headers for your system, add etag or token etc
        $ret_arr["headers"] = $headers;

        //TODO append your options to $result, add accessKey, policy etc
        $options = array("name"=>"lhuap");
        $ret_arr["options"] = $options;
        $ret_arr["fileinfo"] = $result;
    }
}
?>