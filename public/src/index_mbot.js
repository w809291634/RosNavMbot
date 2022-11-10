 /**
   * Setup all visualization elements when the page is loaded. 
   */
  var ros;
  var viewer;
  var nav;
  var controller; 
  var cloudScan;

  // Connect to ROS.

  ros = new ROSLIB.Ros({
    // url:'ws://localhost:9090/'
    url : 'ws://192.168.100.80:9090/'
  });
  
  function init() {
    // Create the main viewer.
    viewer = new ROS2D.Viewer({
      divID : 'nav',
      width : 600,
      height : 600
    });

    //Setup the nav client.
    nav = NAV.OccupancyGridClientNav({
      ros : ros,
      rootObject : viewer.scene,
      viewer : viewer,
      serverName : '/move_base',
      withOrientation:  true,
    });

    // keyboard W A S D control the robot
    controller = NAV.controller(ros, '/cmd_vel', 'controller_show_div')
    
    // show topics
    // var showTopics = new SCAN.topicShowAll(ros,"show_all");
    
    // pointCloud Scan
    cloudScan = new SCAN.cloudScan({
      ros : ros,
      robotName : '/robot_pose',
      // 使用雷达的数据，需转换到点云(旋转效果不好)
      // scanName: '/scan_web',
      // scanType: 'sensor_msgs/LaserScan',
      // isPointedCloud: false,
      // 使用局部地图点云的数据（局部）
      // scanName: '/move_base/local_costmap/lidar_layer/clearing_endpoints',
      // scanType: 'sensor_msgs/PointCloud',
      // isPointedCloud: true
      // 使用全局地图点云的数据（推荐）
      scanName: '/move_base/global_costmap/lidar_layer/clearing_endpoints',
      scanType: 'sensor_msgs/PointCloud',
      isPointedCloud: true
    })
    
    ros.on('error', function(error) {
      document.querySelector('#rosStatus').className = ("error_state");
      document.querySelector('#rosStatus').innerText = "Error in the backend!";
      console.log("[Rosbridge connect] ERROR:",error);
    });
  
    // Find out exactly when we made a connection.
    ros.on('connection', function() {
      console.log('Connection made!');
      // showTopics.update();
      viewer.scene.addChild(cloudScan.poindCloud);
      document.querySelector('#rosStatus').className = ("connected_state");
      document.querySelector('#rosStatus').innerText = " Connected.";
    });
  
    ros.on('close', function() {
      console.log('Connection closed.');
      document.querySelector('#rosStatus').className = ("");
      document.querySelector('#rosStatus').innerText = " Connection closed.";
    });

  }
 