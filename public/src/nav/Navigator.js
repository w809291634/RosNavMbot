/**
 * @author Russell Toris - rctoris@wpi.edu
 * @author Lars Kunze - l.kunze@cs.bham.ac.uk
 * @author Raffaello Bonghi - raffaello.bonghi@officinerobotiche.it
 */

/**
 * A navigator can be used to add click-to-navigate options to an object. If
 * withOrientation is set to true, the user can also specify the orientation of
 * the robot by clicking at the goal position and pointing into the desired
 * direction (while holding the button pressed).
 *
 * @constructor
 * @param options - object with following keys:
 *   * ros - the ROSLIB.Ros connection handle
 *   * tfClient (optional) - the TF client
 *   * robot_pose (optional) - the robot topic or TF to listen position
 *   * serverName (optional) - the action server name to use for navigation, like '/move_base'
 *   * actionName (optional) - the navigation action name, like 'move_base_msgs/MoveBaseAction'
 *   * rootObject (optional) - the root object to add the click listeners to and render robot markers to
 *   * withOrientation (optional) - if the Navigator should consider the robot orientation (default: false)
 */
NAV.Navigator = function(options) {
  var that = this;
  options = options || {};
  var ros = options.ros;
  var tfClient = options.tfClient || null;
  var robot_pose = options.robot_pose || '/robot_pose';
  var serverName = options.serverName || '/move_base';
  var actionName = options.actionName || 'move_base_msgs/MoveBaseAction';
  var withOrientation = options.withOrientation || false;
  var use_image = options.image;
  this.rootObject = options.rootObject || new createjs.Container();
  this.goalMarker = null;

  // setup the actionlib client
  var actionClient = new ROSLIB.ActionClient({
    ros : ros,
    actionName : actionName,
    serverName : serverName
  });
    
  // PATH INIT
  this.planPath = this.planPath||null;
  var pathListener = new ROSLIB.Topic({
    ros: ros,
    // name: '/move_base/NavfnROS/plan',
    name: '/move_base/DWAPlannerROS/global_plan',
    messageType: 'nav_msgs/Path',
    throttle_rate: NAV.THROTTLE_RATE
  });
   // that.rootObject.addChild(that.planPath);
  
  // this.rootObject.addChild(this.planPath);
  var updatePath = function(plan){
    if(!that.planPath){
      that.planPath =  new ROS2D.PathShape({path:plan,strokeSize:0.03,strokeColor:createjs.Graphics.getRGB(94, 82, 125, 0.7)})
      that.rootObject.addChild(that.planPath);
    }else{
      that.rootObject.removeChild(that.planPath);
      that.planPath.setPath(plan);
      that.rootObject.addChild(that.planPath);
    }
  }
  pathListener.subscribe(function(plan) {
    if(plan.poses && plan.poses.length>5){
      updatePath(plan)
    }
  });


  /**
   * Send a goal to the navigation stack with the given pose.
   *
   * @param pose - the goal pose
   */
  function sendGoal(pose) {
    // create a goal
    var goal = new ROSLIB.Goal({
      actionClient : actionClient,
      goalMessage : {
        target_pose : {
          header : {
            frame_id : 'map'
          },
          pose : pose
        }
      }
    });
    goal.send();
    
    that.currentGoal = goal;

    // create a marker for the goal
    if (that.goalMarker === null) {
      console.log('init goal')
      if (use_image && ROS2D.hasOwnProperty('ImageNavigator')) {
        that.goalMarker = new ROS2D.ImageNavigator({
          size: 2.5,
          image: use_image,
          alpha: 0.7,
          pulse: true
        });
      } else {
        that.goalMarker = new RosCanvas.goalPoint({size: 8,pulse: true});
      }
      // that.rootObject.addChild(that.goalMarker);
    }
    that.rootObject.addChild(that.goalMarker);
    that.goalMarker.x = pose.position.x;
    that.goalMarker.y = -pose.position.y;
    that.goalMarker.rotation = stage.rosQuaternionToGlobalTheta(pose.orientation);
    that.goalMarker.scaleX = 1.0 / stage.scaleX;
    that.goalMarker.scaleY = 1.0 / stage.scaleY;

    goal.on('result', function() {
      // TODO
      if(that.planPath){
       that.rootObject.removeChild(that.planPath)
      }

      // that.rootObject.removeChild(that.goalMarker);
      // that.goalMarker = null
    });
  }
  
  /**
   * Cancel the currently active goal.
   */
  this.cancelGoal = function () {
    if (typeof that.currentGoal !== 'undefined') {
      that.currentGoal.cancel();
    }
  };

  // get a handle to the stage
  var stage;
  if (that.rootObject instanceof createjs.Stage) {
    stage = that.rootObject;
  } else {
    stage = that.rootObject.getStage();
  }

  // marker for the robot
  var robotMarker = null;
  if (use_image && ROS2D.hasOwnProperty('ImageNavigator')) {
    robotMarker = new ROS2D.ImageNavigator({
      size: 2.0,
      image: use_image,
      pulse: true
    });
  } else {
    robotMarker = new ROS2D.NavigationArrow({
      size : 20,
      strokeSize : 0.1,
      fillColor :"#583c8a",
      pulse : true
    });
  }

  // wait for a pose to come in first
  robotMarker.visible = false;
  this.rootObject.addChild(robotMarker);
  var initScaleSet = false;

  var updateRobotPosition = function(pose, orientation) {
    // update the robots position on the map
    robotMarker.x = pose.x;
    robotMarker.y = -pose.y;
    if (!initScaleSet) {
      robotMarker.scaleX = 1.0 / stage.scaleX;
      robotMarker.scaleY = 1.0 / stage.scaleY;
      initScaleSet = true;
    }
    // change the angle
    robotMarker.rotation = stage.rosQuaternionToGlobalTheta(orientation);
    // Set visible
    robotMarker.visible = true;
  };

  if(tfClient !== null) {
    tfClient.subscribe(robot_pose, function(tf) {
      console.log("subscribe robot_pose tf:", tf)
      updateRobotPosition(tf.translation,tf.rotation);
    });
  } else {
    // setup a listener for the robot pose
    var poseListener = new ROSLIB.Topic({
      ros: ros,
      name: robot_pose,
      messageType: 'geometry_msgs/Pose',
      throttle_rate: NAV.THROTTLE_RATE
    });
    poseListener.subscribe(function(pose) {
      // console.log("subscribe robot_pose pose:", pose)
      updateRobotPosition(pose.position,pose.orientation);
    });
  }

  
  if (withOrientation === false){
    // setup a double click listener (no orientation)
    this.rootObject.addEventListener('dblclick', function(event) {
      // convert to ROS coordinates
     if(that.planPath){
      that.rootObject.removeChild(that.planPath)
     }

      var coords = stage.globalToRos(event.stageX, event.stageY);
      var pose = new ROSLIB.Pose({
        position : new ROSLIB.Vector3(coords)
      });
      // send the goal
      sendGoal(pose);
    });
  } else { // withOrientation === true
    // setup a click-and-point listener (with orientation)
    var position = null;
    var positionVec3 = null;
    var thetaRadians = 0;
    var thetaDegrees = 0;
    var orientationMarker = null;
    var mouseDown = false;
    var xDelta = 0;
    var yDelta = 0;

    // mouse processing events
    var mouseEventHandler = function(event, mouseState) {
      if (mouseState === 'down'){
        // get position when mouse button is pressed down
        position = stage.globalToRos(event.stageX, event.stageY);
        positionVec3 = new ROSLIB.Vector3(position);
        mouseDown = true;
      }
      else if (mouseState === 'move'){
        // remove obsolete orientation marker
        that.rootObject.removeChild(orientationMarker);

        if ( mouseDown === true) {
          // if mouse button is held down:
          // - get current mouse position
          // - calulate direction between stored <position> and current position
          // - place orientation marker
          var currentPos = stage.globalToRos(event.stageX, event.stageY);
          var currentPosVec3 = new ROSLIB.Vector3(currentPos);

          if (use_image && ROS2D.hasOwnProperty('ImageNavigator')) {
            orientationMarker = new ROS2D.ImageNavigator({
              size: 2.5,
              image: use_image,
              alpha: 0.7,
              pulse: false
            });
          } else {
            orientationMarker = new ROS2D.NavigationArrow({
              size : 25,
              strokeSize : 1,
              fillColor : createjs.Graphics.getRGB(0, 255, 0, 0.66),
              pulse : false
            });
          }

          xDelta =  currentPosVec3.x - positionVec3.x;
          yDelta =  currentPosVec3.y - positionVec3.y;

          thetaRadians  = Math.atan2(xDelta,yDelta);

          thetaDegrees = thetaRadians * (180.0 / Math.PI);

          if (thetaDegrees >= 0 && thetaDegrees <= 180) {
            thetaDegrees += 270;
          } else {
            thetaDegrees -= 90;
          }

          orientationMarker.x =  positionVec3.x;
          orientationMarker.y = -positionVec3.y;
          orientationMarker.rotation = thetaDegrees;
          orientationMarker.scaleX = 1.0 / stage.scaleX;
          orientationMarker.scaleY = 1.0 / stage.scaleY;

          that.rootObject.addChild(orientationMarker);
          this.move_flag = true
        }
      } else if (mouseState === 'up') { // mouseState === 'up' //mouseDown
        // if mouse button is released
        // - get current mouse position (goalPos)
        // - calulate direction between stored <position> and goal position
        // - set pose with orientation
        // - send goal
        mouseDown = false;
        if(this.move_flag){
          var goalPos = stage.globalToRos(event.stageX, event.stageY);
          console.log("goalPos",goalPos);
          var goalPosVec3 = new ROSLIB.Vector3(goalPos);
          console.log("goalPosVec3",goalPosVec3);
          xDelta =  goalPosVec3.x - positionVec3.x;
          yDelta =  goalPosVec3.y - positionVec3.y;

          thetaRadians  = Math.atan2(xDelta,yDelta);
          console.log("thetaRadians",thetaRadians);

          if (thetaRadians >= 0 && thetaRadians <= Math.PI) {
            thetaRadians += (3 * Math.PI / 2);
          } else {
            thetaRadians -= (Math.PI/2);
          }

          var qz =  Math.sin(-thetaRadians/2.0);
          var qw =  Math.cos(-thetaRadians/2.0);

          var orientation = new ROSLIB.Quaternion({x:0, y:0, z:qz, w:qw});

          var pose = new ROSLIB.Pose({
            position :    positionVec3,
            orientation : orientation
          });
          console.log(pose);
          // send the goal
          sendGoal(pose);
        }
        this.move_flag = false;
      }
    };

    this.rootObject.addEventListener('stagemousedown', function(event) {
      mouseEventHandler(event,'down');
    });

    this.rootObject.addEventListener('stagemousemove', function(event) {
      mouseEventHandler(event,'move');
    });

    this.rootObject.addEventListener('stagemouseup', function(event) {
      mouseEventHandler(event,'up');
    });
  }
};
