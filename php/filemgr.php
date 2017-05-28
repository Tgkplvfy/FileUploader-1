<?php
require_once(__DIR__."/FileManager.class.php");

//var_dump($_FILES["chunk_data"]);
//return;

$ret_arr = array();
if(!isset($_REQUEST["cmd"])){
    $ret_arr["code"] = 400;
    $ret_arr["error"] = "Invalid Request:command not exist";
    echo json_encode($ret_arr);
    return;
}

$params = array();//modify code here to add your config
$filemgr = FileManager::getInstance($params);

$cmd = $_REQUEST["cmd"];
if(!$filemgr->hasRights($cmd)){
    $ret_arr["code"] = 403;
    $ret_arr["error"] = "Access Denied : no rights to do command ".$cmd;
    echo json_encode($ret_arr);
    return;
}

switch($cmd){
    case "chunk":
        $filemgr->getUploadChunk($ret_arr);
        break;
    case "files":
        $filemgr->getUploadFiles($ret_arr);
        break;
    case "fopen":
        $filemgr->authFileOpen($ret_arr);
        break;
    case "list":
        $filemgr->listDir($ret_arr);
        break;
    case "exist":
        $filemgr->exists($ret_arr);
        break;
    case "unlink":
        $filemgr->fileUnlink($ret_arr);
        break;
    case "mkdir":
        $filemgr->dirCreate($ret_arr);
        break;
    case "rmdir":
        $filemgr->dirRemove($ret_arr);
        break;
    case "rename":
        $filemgr->new_name($ret_arr);
        break;
    default:
        $ret_arr["code"] = 400;
        $ret_arr["command"] = "Invalid Request: command not support";
        break;
}
echo json_encode($ret_arr);
?>