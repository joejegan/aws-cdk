import { SynthUtils } from '@aws-cdk/assert-internal';
import '@aws-cdk/assert-internal/jest';
import * as autoscaling from '@aws-cdk/aws-autoscaling';
import * as cloudwatch from '@aws-cdk/aws-cloudwatch';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as lbv2 from '@aws-cdk/aws-elasticloadbalancingv2';
import * as cdk from '@aws-cdk/core';
import * as codedeploy from '../../lib';

/* eslint-disable quote-props */

describe('CodeDeploy Server Deployment Group', () => {
  test('can be created by explicitly passing an Application', () => {
    const stack = new cdk.Stack();

    const application = new codedeploy.ServerApplication(stack, 'MyApp');
    new codedeploy.ServerDeploymentGroup(stack, 'MyDG', {
      application,
    });

    expect(stack).toHaveResource('AWS::CodeDeploy::DeploymentGroup', {
      'ApplicationName': {
        'Ref': 'MyApp3CE31C26',
      },
    });
  });

  test('creating an application with physical name if needed', () => {
    const stack = new cdk.Stack(undefined, undefined, { env: { account: '12345', region: 'us-test-1' } });
    const stack2 = new cdk.Stack(undefined, undefined, { env: { account: '12346', region: 'us-test-2' } });
    const serverDeploymentGroup = new codedeploy.ServerDeploymentGroup(stack, 'MyDG', {
      deploymentGroupName: cdk.PhysicalName.GENERATE_IF_NEEDED,
    });

    new cdk.CfnOutput(stack2, 'Output', {
      value: serverDeploymentGroup.application.applicationName,
    });

    expect(stack2).toHaveOutput({
      outputName: 'Output',
      outputValue: 'defaultmydgapplication78dba0bb0c7580b32033',
    });
  });

  test('can be imported', () => {
    const stack = new cdk.Stack();

    const application = codedeploy.ServerApplication.fromServerApplicationName(stack, 'MyApp', 'MyApp');
    const deploymentGroup = codedeploy.ServerDeploymentGroup.fromServerDeploymentGroupAttributes(stack, 'MyDG', {
      application,
      deploymentGroupName: 'MyDG',
    });

    expect(deploymentGroup).not.toEqual(undefined);
  });

  test('uses good linux install agent script', () => {
    const stack = new cdk.Stack();

    const asg = new autoscaling.AutoScalingGroup(stack, 'ASG', {
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.STANDARD3, ec2.InstanceSize.SMALL),
      machineImage: new ec2.AmazonLinuxImage(),
      vpc: new ec2.Vpc(stack, 'VPC'),
    });

    new codedeploy.ServerDeploymentGroup(stack, 'DeploymentGroup', {
      autoScalingGroups: [asg],
      installAgent: true,
    });

    expect(stack).toHaveResource('AWS::AutoScaling::LaunchConfiguration', {
      'UserData': {
        'Fn::Base64': {
          'Fn::Join': [
            '',
            [
              '#!/bin/bash\nset +e\nPKG_CMD=`which yum 2>/dev/null`\nset -e\nif [ -z "$PKG_CMD" ]; then\nPKG_CMD=apt-get\nelse\nPKG_CMD=yum\nfi\n$PKG_CMD update -y\nset +e\n$PKG_CMD install -y ruby2.0\nRUBY2_INSTALL=$?\nset -e\nif [ $RUBY2_INSTALL -ne 0 ]; then\n$PKG_CMD install -y ruby\nfi\nAWS_CLI_PACKAGE_NAME=awscli\nif [ "$PKG_CMD" = "yum" ]; then\nAWS_CLI_PACKAGE_NAME=aws-cli\nfi\n$PKG_CMD install -y $AWS_CLI_PACKAGE_NAME\nTMP_DIR=`mktemp -d`\ncd $TMP_DIR\naws s3 cp s3://aws-codedeploy-',
              {
                'Ref': 'AWS::Region',
              },
              '/latest/install . --region ',
              {
                'Ref': 'AWS::Region',
              },
              '\nchmod +x ./install\n./install auto\nrm -fr $TMP_DIR',
            ],
          ],
        },
      },
    });
  });

  test('uses good windows install agent script', () => {
    const stack = new cdk.Stack();

    const asg = new autoscaling.AutoScalingGroup(stack, 'ASG', {
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.STANDARD3, ec2.InstanceSize.SMALL),
      machineImage: new ec2.WindowsImage(ec2.WindowsVersion.WINDOWS_SERVER_2019_ENGLISH_FULL_BASE, {}),
      vpc: new ec2.Vpc(stack, 'VPC'),
    });

    new codedeploy.ServerDeploymentGroup(stack, 'DeploymentGroup', {
      autoScalingGroups: [asg],
      installAgent: true,
    });

    expect(stack).toHaveResource('AWS::AutoScaling::LaunchConfiguration', {
      'UserData': {
        'Fn::Base64': {
          'Fn::Join': [
            '',
            [
              '<powershell>Set-Variable -Name TEMPDIR -Value (New-TemporaryFile).DirectoryName\naws s3 cp s3://aws-codedeploy-',
              {
                'Ref': 'AWS::Region',
              },
              '/latest/codedeploy-agent.msi $TEMPDIR\\codedeploy-agent.msi\ncd $TEMPDIR\n.\\codedeploy-agent.msi /quiet /l c:\\temp\\host-agent-install-log.txt</powershell>',
            ],
          ],
        },
      },
    });
  });

  test('created with ASGs contains the ASG names', () => {
    const stack = new cdk.Stack();

    const asg = new autoscaling.AutoScalingGroup(stack, 'ASG', {
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.STANDARD3, ec2.InstanceSize.SMALL),
      machineImage: new ec2.AmazonLinuxImage(),
      vpc: new ec2.Vpc(stack, 'VPC'),
    });

    new codedeploy.ServerDeploymentGroup(stack, 'DeploymentGroup', {
      autoScalingGroups: [asg],
    });

    expect(stack).toHaveResource('AWS::CodeDeploy::DeploymentGroup', {
      'AutoScalingGroups': [
        {
          'Ref': 'ASG46ED3070',
        },
      ],
    });
  });

  test('created without ASGs but adding them later contains the ASG names', () => {
    const stack = new cdk.Stack();

    const asg = new autoscaling.AutoScalingGroup(stack, 'ASG', {
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.STANDARD3, ec2.InstanceSize.SMALL),
      machineImage: new ec2.AmazonLinuxImage(),
      vpc: new ec2.Vpc(stack, 'VPC'),
    });

    const deploymentGroup = new codedeploy.ServerDeploymentGroup(stack, 'DeploymentGroup');
    deploymentGroup.addAutoScalingGroup(asg);

    expect(stack).toHaveResource('AWS::CodeDeploy::DeploymentGroup', {
      'AutoScalingGroups': [
        {
          'Ref': 'ASG46ED3070',
        },
      ],
    });
  });

  test('can be created with an ALB Target Group as the load balancer', () => {
    const stack = new cdk.Stack();

    const alb = new lbv2.ApplicationLoadBalancer(stack, 'ALB', {
      vpc: new ec2.Vpc(stack, 'VPC'),
    });
    const listener = alb.addListener('Listener', { protocol: lbv2.ApplicationProtocol.HTTP });
    const targetGroup = listener.addTargets('Fleet', { protocol: lbv2.ApplicationProtocol.HTTP });

    new codedeploy.ServerDeploymentGroup(stack, 'DeploymentGroup', {
      loadBalancer: codedeploy.LoadBalancer.application(targetGroup),
    });

    expect(stack).toHaveResource('AWS::CodeDeploy::DeploymentGroup', {
      'LoadBalancerInfo': {
        'TargetGroupInfoList': [
          {
            'Name': {
              'Fn::GetAtt': [
                'ALBListenerFleetGroup008CEEE4',
                'TargetGroupName',
              ],
            },
          },
        ],
      },
      'DeploymentStyle': {
        'DeploymentOption': 'WITH_TRAFFIC_CONTROL',
      },
    });
  });

  test('can be created with an NLB Target Group as the load balancer', () => {
    const stack = new cdk.Stack();

    const nlb = new lbv2.NetworkLoadBalancer(stack, 'NLB', {
      vpc: new ec2.Vpc(stack, 'VPC'),
    });
    const listener = nlb.addListener('Listener', { port: 80 });
    const targetGroup = listener.addTargets('Fleet', { port: 80 });

    new codedeploy.ServerDeploymentGroup(stack, 'DeploymentGroup', {
      loadBalancer: codedeploy.LoadBalancer.network(targetGroup),
    });

    expect(stack).toHaveResource('AWS::CodeDeploy::DeploymentGroup', {
      'LoadBalancerInfo': {
        'TargetGroupInfoList': [
          {
            'Name': {
              'Fn::GetAtt': [
                'NLBListenerFleetGroupB882EC86',
                'TargetGroupName',
              ],
            },
          },
        ],
      },
      'DeploymentStyle': {
        'DeploymentOption': 'WITH_TRAFFIC_CONTROL',
      },
    });
  });

  test('can be created with a single EC2 instance tag set with a single or no value', () => {
    const stack = new cdk.Stack();

    new codedeploy.ServerDeploymentGroup(stack, 'DeploymentGroup', {
      ec2InstanceTags: new codedeploy.InstanceTagSet(
        {
          'some-key': ['some-value'],
          'other-key': [],
        },
      ),
    });

    expect(stack).toHaveResource('AWS::CodeDeploy::DeploymentGroup', {
      'Ec2TagSet': {
        'Ec2TagSetList': [
          {
            'Ec2TagGroup': [
              {
                'Key': 'some-key',
                'Value': 'some-value',
                'Type': 'KEY_AND_VALUE',
              },
              {
                'Key': 'other-key',
                'Type': 'KEY_ONLY',
              },
            ],
          },
        ],
      },
    });
  });

  test('can be created with two on-premise instance tag sets with multiple values or without a key', () => {
    const stack = new cdk.Stack();

    new codedeploy.ServerDeploymentGroup(stack, 'DeploymentGroup', {
      onPremiseInstanceTags: new codedeploy.InstanceTagSet(
        {
          'some-key': ['some-value', 'another-value'],
        },
        {
          '': ['keyless-value'],
        },
      ),
    });

    expect(stack).toHaveResource('AWS::CodeDeploy::DeploymentGroup', {
      'OnPremisesTagSet': {
        'OnPremisesTagSetList': [
          {
            'OnPremisesTagGroup': [
              {
                'Key': 'some-key',
                'Value': 'some-value',
                'Type': 'KEY_AND_VALUE',
              },
              {
                'Key': 'some-key',
                'Value': 'another-value',
                'Type': 'KEY_AND_VALUE',
              },
            ],
          },
          {
            'OnPremisesTagGroup': [
              {
                'Value': 'keyless-value',
                'Type': 'VALUE_ONLY',
              },
            ],
          },
        ],
      },
    });
  });

  test('cannot be created with an instance tag set containing a keyless, valueless filter', () => {
    const stack = new cdk.Stack();

    expect(() => {
      new codedeploy.ServerDeploymentGroup(stack, 'DeploymentGroup', {
        onPremiseInstanceTags: new codedeploy.InstanceTagSet({
          '': [],
        }),
      });
    }).toThrow();
  });

  test('cannot be created with an instance tag set containing 4 instance tag groups', () => {
    const stack = new cdk.Stack();

    expect(() => {
      new codedeploy.ServerDeploymentGroup(stack, 'DeploymentGroup', {
        onPremiseInstanceTags: new codedeploy.InstanceTagSet({}, {}, {}, {}),
      });
    }).toThrow(/3/);
  });

  test('can have alarms added to it after being created', () => {
    const stack = new cdk.Stack();

    const alarm = new cloudwatch.Alarm(stack, 'Alarm1', {
      metric: new cloudwatch.Metric({
        metricName: 'Errors',
        namespace: 'my.namespace',
      }),
      threshold: 1,
      evaluationPeriods: 1,
    });

    const deploymentGroup = new codedeploy.ServerDeploymentGroup(stack, 'DeploymentGroup');
    deploymentGroup.addAlarm(alarm);

    expect(stack).toHaveResource('AWS::CodeDeploy::DeploymentGroup', {
      'AlarmConfiguration': {
        'Alarms': [
          {
            'Name': {
              'Ref': 'Alarm1F9009D71',
            },
          },
        ],
        'Enabled': true,
      },
    });
  });

  test('only automatically rolls back failed deployments by default', () => {
    const stack = new cdk.Stack();

    new codedeploy.ServerDeploymentGroup(stack, 'DeploymentGroup');

    expect(stack).toHaveResource('AWS::CodeDeploy::DeploymentGroup', {
      'AutoRollbackConfiguration': {
        'Enabled': true,
        'Events': [
          'DEPLOYMENT_FAILURE',
        ],
      },
    });
  });

  test('rolls back alarmed deployments if at least one alarm has been added', () => {
    const stack = new cdk.Stack();

    const alarm = new cloudwatch.Alarm(stack, 'Alarm1', {
      metric: new cloudwatch.Metric({
        metricName: 'Errors',
        namespace: 'my.namespace',
      }),
      threshold: 1,
      evaluationPeriods: 1,
    });

    const deploymentGroup = new codedeploy.ServerDeploymentGroup(stack, 'DeploymentGroup', {
      autoRollback: {
        failedDeployment: false,
      },
    });
    deploymentGroup.addAlarm(alarm);

    expect(stack).toHaveResource('AWS::CodeDeploy::DeploymentGroup', {
      'AutoRollbackConfiguration': {
        'Enabled': true,
        'Events': [
          'DEPLOYMENT_STOP_ON_ALARM',
        ],
      },
    });
  });

  test('setting to roll back on alarms without providing any results in an exception', () => {
    const stack = new cdk.Stack();

    new codedeploy.ServerDeploymentGroup(stack, 'DeploymentGroup', {
      autoRollback: {
        deploymentInAlarm: true,
      },
    });

    expect(() => SynthUtils.toCloudFormation(stack)).toThrow(/deploymentInAlarm/);
  });

  test('can be used with an imported ALB Target Group as the load balancer', () => {
    const stack = new cdk.Stack();

    new codedeploy.ServerDeploymentGroup(stack, 'DeploymentGroup', {
      loadBalancer: codedeploy.LoadBalancer.application(
        lbv2.ApplicationTargetGroup.fromTargetGroupAttributes(stack, 'importedAlbTg', {
          targetGroupArn: 'arn:aws:elasticloadbalancing:us-west-2:123456789012:targetgroup/myAlbTargetGroup/73e2d6bc24d8a067',
        }),
      ),
    });

    expect(stack).toHaveResourceLike('AWS::CodeDeploy::DeploymentGroup', {
      'LoadBalancerInfo': {
        'TargetGroupInfoList': [
          {
            'Name': 'myAlbTargetGroup',
          },
        ],
      },
      'DeploymentStyle': {
        'DeploymentOption': 'WITH_TRAFFIC_CONTROL',
      },
    });
  });

});
